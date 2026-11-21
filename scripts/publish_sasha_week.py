"""One Revolute writer for the public Sasha report. Called by the export queue."""
from datetime import datetime
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import sys
import tempfile
from urllib.request import Request, urlopen

from sasha_week import MSK, canonical, render, require, should_update, validate

SITE = "git@github.com:yzotop/alexdavydov.github.io.git"
WEB = "https://davydov.my/ai-first/workshop/sasha/"
PAGE = "ai-first/workshop/sasha/index.html"
ARTIFACT = "ai-first/workshop/sasha/calendar-current.json"
KEYS = re.compile(rb"gh[pousr]_[A-Za-z0-9_]{30,}|github_pat_[A-Za-z0-9_]{40,}|sk-(?:proj-)?[A-Za-z0-9_-]{24,}|AKIA[A-Z0-9]{16}|-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----")
SENSITIVE = re.compile(rb"/(?:Users|home|Volumes|private/tmp)/[^\s<>]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|https?://[^\s<>\"']*(?:intranet|mattermost|\.internal\b|\.corp\b|\.kontur\.ru\b)|(?i:GOAPAKE-\d+|real_tests/)")


def git(repo, *args):
    return subprocess.check_output(["git", "-C", str(repo), *args], timeout=70)


def scan(repo, history_repo, base):
    history = git(history_repo, "log", "--all", "-p", "--format=", "--no-ext-diff")
    require(not KEYS.search(history), "key in site history")
    allowed = set()
    for name in git(repo, "ls-tree", "-r", "--name-only", "-z", base).split(b"\0"):
        if not name:
            continue
        path = os.fsdecode(name)
        previous = git(repo, "show", base+":"+path) if path in (PAGE,ARTIFACT) else (repo/path).read_bytes()
        require(not KEYS.search(previous), "key in site tree")
        allowed.update(SENSITIVE.findall(previous))
    historical = set(SENSITIVE.findall(history))
    candidate = (repo/PAGE).read_bytes()+(repo/ARTIFACT).read_bytes()
    require(not KEYS.search(candidate) and not set(SENSITIVE.findall(candidate))-allowed,
            "new sensitive match in publication files")
    print(f"site scan: {len(historical)} existing history matches, {len(allowed)} existing tree matches, no new matches")


def confirm_live(page, artifact, revision):
    for suffix, expected in (("", page), ("calendar-current.json", artifact)):
        request = Request(WEB+suffix+"?v="+revision[:16], headers={"Cache-Control":"no-cache"})
        with urlopen(request, timeout=12) as response:
            if response.status!=200 or response.read()!=expected:
                raise OSError("Pages has not served the expected bytes")


def attempt(runtime, candidate, live=confirm_live):
    repo = runtime/"checkout"
    require(git(repo,"remote","get-url","origin").decode().strip()==SITE, "wrong site remote")
    git(repo,"fetch","--prune","origin")
    base = git(repo,"rev-parse","origin/main").decode().strip()
    page = git(repo,"show",base+":"+PAGE)
    existing = bool(git(repo,"ls-tree","-r","--name-only",base,"--",ARTIFACT))
    prior = json.loads(git(repo,"show",base+":"+ARTIFACT)) if existing else None
    now = datetime.now(MSK)
    if prior:
        validate(prior,now)
    ledgers = sorted((runtime.parent/"releases").glob("week-*-final.json"))
    if not ledgers:
        raise OSError("export ledger not available yet")
    latest = json.loads(ledgers[-1].read_text())
    if (candidate["release_id"],candidate["revision_sha256"]) != (latest["release_id"],latest["revision_sha256"]):
        if prior and (prior["release_id"],prior["revision_sha256"]) == (latest["release_id"],latest["revision_sha256"]):
            live(page,canonical(prior)+b"\n",prior["revision_sha256"])
            print("Superseded by verified public release:",prior["release_id"],prior["revision_sha256"])
            return
        raise OSError("waiting for latest exported revision to go live")
    if not should_update(candidate,prior):
        # If a push already succeeded, verify that commit on Pages instead of writing again.
        live(page,canonical(prior)+b"\n",prior["revision_sha256"])
        print("Already delivered:",prior["release_id"],prior["revision_sha256"])
        return
    if b"<!-- sasha-week:report:start -->" not in page:
        raise OSError("site template has not been deployed")
    data=canonical(candidate)+b"\n"
    updated=render(page.decode(),candidate).encode()
    require(updated!=page, "renderer made no change")
    with tempfile.TemporaryDirectory(prefix="sasha-site-", dir=runtime) as temp:
        work=Path(temp)/"site"
        git(repo,"worktree","add","--detach",str(work),base)
        try:
            (work/PAGE).write_bytes(updated)
            (work/ARTIFACT).write_bytes(data)
            scan(work,repo,base)
            git(work,"add","--",PAGE,ARTIFACT)
            require(set(git(work,"diff","--cached","--name-only").decode().splitlines())=={PAGE,ARTIFACT},
                    "unexpected publication scope")
            git(work,"diff","--cached","--check")
            for script in ("check_meta_css_refs.py","check_redirects.py","check_goatcounter.py"):
                subprocess.run([sys.executable,"scripts/"+script],cwd=work,check=True,timeout=45)
            git(work,"-c","user.name=Sasha calendar publisher","-c","user.email=yzotop@users.noreply.github.com",
                "commit","-m","Publish Sasha "+candidate["release_id"])
            # Normal fast-forward only. A concurrent upstream commit leaves the old page intact.
            git(work,"push","origin","HEAD:refs/heads/main")
        finally:
            git(repo,"worktree","remove","--force",str(work))
    live(updated,data,candidate["revision_sha256"])
    print("Published and verified:",candidate["release_id"],candidate["revision_sha256"])


def load_candidate(outbox, path, expected_hash, now):
    raw = path.read_bytes()
    require(len(raw) <= 25_000 and hashlib.sha256(raw).hexdigest()==expected_hash, "artifact hash or size mismatch")
    data=json.loads(raw)
    validate(data,now)
    expected=outbox/data["release_id"]/(data["revision_sha256"]+".json")
    require(path==expected and path.resolve()==expected, "artifact outside immutable outbox")
    return data


def main(argv):
    runtime=Path(__file__).resolve().parent
    outbox=runtime.parent/"outbox"
    if len(argv)!=2:
        print("usage: publish.py ABSOLUTE_OUTBOX_PATH SHA256",file=sys.stderr)
        return 65
    try:
        candidate=load_candidate(outbox,Path(argv[0]),argv[1],datetime.now(MSK))
    except (KeyError,ValueError,TypeError,ArithmeticError,OSError) as err:
        print("Artifact rejected:",type(err).__name__,file=sys.stderr)
        return 65
    try:
        config = json.loads((runtime/"transport.json").read_text())
        ssh=["ssh","-o","BatchMode=yes","-o","IdentitiesOnly=yes","-o","StrictHostKeyChecking=yes",
             "-o","ConnectTimeout=15","-i",config["identity"],"-o","UserKnownHostsFile="+config["known_hosts"]]
        os.environ["GIT_SSH_COMMAND"]=shlex.join(ssh)
        os.environ["GIT_TERMINAL_PROMPT"]="0"
        with (runtime/"writer.lock").open("a") as lock:
            fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
            attempt(runtime,candidate)
    except (OSError,subprocess.SubprocessError) as err:
        print("Delivery retry:",type(err).__name__,file=sys.stderr)
        return 75
    except (KeyError,ValueError,TypeError,ArithmeticError) as err:
        print("Delivery rejected:",type(err).__name__,file=sys.stderr)
        return 65
    return 0


if __name__=="__main__":
    sys.exit(main(sys.argv[1:]))
