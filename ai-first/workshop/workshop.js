(() => {
 const answer=document.querySelector('#first-answer'),button=document.querySelector('#save-answer');
 answer.addEventListener('input',()=>{button.disabled=!answer.value.trim();});
 button.addEventListener('click',()=>{if(!answer.value.trim())return;const u=URL.createObjectURL(new Blob([answer.value],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=u;a.download='colleague-first-answer.txt';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);document.querySelector('#answer-status').textContent='Ответ сохранён в файл.';});
 document.querySelectorAll('[data-open-result]').forEach(a=>a.addEventListener('click',()=>{document.querySelector('#observed-result').open=true;}));
 document.querySelectorAll('a[href="#solution"]').forEach(a=>a.addEventListener('click',()=>{document.querySelector('#solution').open=true;}));
})();
