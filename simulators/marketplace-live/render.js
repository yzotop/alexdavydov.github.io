/* render.js — Canvas rendering: market flow visualization */

(() => {
  'use strict';

  const U = window.Utils;
  if (!U) throw new Error('utils.js must be loaded before render.js');
  
  const LIMITS = {
    max_visible_buyers: 250,
  };

  function resizeCanvasToElement(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    return { cssW: rect.width, cssH: rect.height, w, h, dpr };
  }

  function qualityColor(q) {
    // Map quality [0..1] to color: low → red, high → green
    const t = U.clamp(q, 0, 1);
    const r = Math.round(U.lerp(251, 52, t));
    const g = Math.round(U.lerp(113, 211, t));
    const b = Math.round(U.lerp(133, 153, t));
    return `rgba(${r},${g},${b},0.9)`;
  }

  function drawRoundedRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  class Renderer {
    constructor({ mainCanvas }) {
      this.mainCanvas = mainCanvas;
      this.ctx = mainCanvas.getContext('2d', { alpha: true, desynchronized: true });
      if (!this.ctx) throw new Error('2D context not available for main canvas');
      this.viewMode = 'learn'; // learn | explore | debug
    }

    setViewMode(mode) {
      this.viewMode = mode;
    }

    draw(sim, alpha, dtFrameSec) {
      const { w, h, dpr } = resizeCanvasToElement(this.mainCanvas);
      const ctx = this.ctx;

      ctx.save();
      ctx.scale(dpr, dpr);

      const W = w / dpr;
      const H = h / dpr;
      ctx.clearRect(0, 0, W, H);

      // Background
      this._drawBackground(ctx, W, H);

      if (this.viewMode === 'learn') {
        this._drawLearnMode(ctx, W, H, sim);
      } else if (this.viewMode === 'explore') {
        this._drawExploreMode(ctx, W, H, sim);
      } else {
        this._drawDebugMode(ctx, W, H, sim);
      }

      ctx.restore();
    }
    
    _drawLearnMode(ctx, W, H, sim) {
      // Simplified layout for learning
      const centerX = W * 0.5;
      const centerY = H * 0.5;
      
      // Hero buyer (left side)
      this._drawHeroBuyerLearn(ctx, W, H, sim);
      
      // 5 last active buyers (B1..B6, excluding hero)
      this._drawLastBuyers(ctx, W, H, sim);
      
      // Hero Card (large, center)
      this._drawHeroCard(ctx, W, H, centerX, centerY, sim);
      
      // Feed list (compact, left of hero card)
      this._drawFeedList(ctx, W, H, centerX - 200, centerY, sim);
      
      // Hero lines (impressions, orders) in Learn mode
      this._drawHeroLinesLearn(ctx, W, H, centerX, centerY, sim);
      
      // Delivery queue (stack, right side)
      this._drawDeliveryQueueStack(ctx, W, H, centerX + 150, centerY, sim);
      
      // Capacity widget (near queue)
      this._drawCapacityWidget(ctx, W, H, centerX + 150, centerY - 100, sim);
      
      // Delivery particles (only hero)
      this._drawDeliveryParticlesLearn(ctx, W, H, centerX, centerY, sim);
      
      // Trust bar
      this._drawTrustBar(ctx, W, H, sim);
    }
    
    _drawLastBuyers(ctx, W, H, sim) {
      ctx.save();
      
      // Get last 5 active buyers (excluding hero)
      const candidates = sim.buyers.filter(b => b.id !== sim.heroBuyerId);
      const lastBuyers = candidates.slice(-5);
      
      const startX = W * 0.15;
      const startY = H * 0.3;
      const spacing = 30;
      
      for (let i = 0; i < lastBuyers.length; i++) {
        const buyer = lastBuyers[i];
        const x = startX;
        const y = startY + i * spacing;
        const size = 6;
        
        // Buyer dot
        ctx.fillStyle = 'rgba(96,165,250,0.6)';
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = 'rgba(59,130,246,0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Label
        ctx.fillStyle = 'rgba(229,231,235,0.7)';
        ctx.font = '9px ui-sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`B${i + 1}`, x + size + 4, y + 4);
      }
      
      ctx.restore();
    }
    
    _drawHeroLinesLearn(ctx, W, H, centerX, centerY, sim) {
      if (!sim.heroBuyerId) return;
      
      const hero = sim.buyers.find(b => b.id === sim.heroBuyerId);
      if (!hero) return;
      
      ctx.save();
      const heroX = W * 0.15;
      const heroY = H * 0.5;
      const feedX = centerX - 200;
      const feedY = centerY;
      const queueX = centerX + 150;
      const queueY = centerY;
      
      // Impression lines (dotted)
      for (let event of sim.heroEvents) {
        if (event.type === 'impression') {
          const age = sim.time - event.t;
          if (age > 0.5) continue;
          const alpha = 1 - age / 0.5;
          const slotIndex = event.data.slotIndex || 0;
          const itemY = feedY - (sim.feed.length * 20) / 2 + slotIndex * 20 + 10;
          
          ctx.strokeStyle = `rgba(96,165,250,${alpha * 0.4})`;
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(heroX, heroY);
          ctx.lineTo(feedX + 160, itemY);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      
      // Order line (solid)
      for (let line of sim.purchase_lines) {
        if (line.isHero && line.buyer.id === sim.heroBuyerId) {
          const age = sim.time - line.t0;
          if (age > line.ttl) continue;
          const alpha = 1 - age / line.ttl;
          const slotIndex = line.slotIndex || 0;
          const itemY = feedY - (sim.feed.length * 20) / 2 + slotIndex * 20 + 10;
          
          // Line: hero → feed → queue
          ctx.strokeStyle = `rgba(251,191,36,${alpha * 0.8})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(heroX, heroY);
          ctx.lineTo(feedX + 160, itemY);
          ctx.lineTo(queueX, queueY);
          ctx.stroke();
        }
      }
      
      ctx.restore();
    }
    
    _drawDeliveryParticlesLearn(ctx, W, H, centerX, centerY, sim) {
      ctx.save();
      
      const heroX = W * 0.15;
      const heroY = H * 0.5;
      const queueX = centerX + 150;
      const queueY = centerY;
      
      // Only show hero deliveries
      for (let order of sim.delivery_queue) {
        if (order.delivered || order.cancelled) continue;
        if (order.buyer.id !== sim.heroBuyerId) continue;
        
        const progress = order.delivery_progress;
        const startX = queueX;
        const startY = queueY;
        const endX = heroX;
        const endY = heroY;
        
        const x = U.lerp(startX, endX, progress);
        const y = U.lerp(startY, endY, progress);
        
        ctx.fillStyle = 'rgba(251,191,36,0.95)';
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = 'rgba(251,191,36,0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      
      ctx.restore();
    }
    
    _drawExploreMode(ctx, W, H, sim) {
      // Current rich view
      const leftZone = W * 0.12;
      const feedZone = W * 0.45;
      const rightZone = W * 0.88;
      const queueZone = W * 0.92;

      this._drawZoneLabels(ctx, W, H, leftZone, feedZone, rightZone, queueZone);
      this._drawSellers(ctx, W, H, rightZone, sim);
      this._drawFeed(ctx, W, H, leftZone, feedZone, sim);
      this._drawDeliveryQueue(ctx, W, H, feedZone, queueZone, sim);
      this._drawBuyers(ctx, W, H, leftZone, sim);
      this._drawHeroBuyer(ctx, W, H, leftZone, sim);
      this._drawHeroLines(ctx, W, H, leftZone, feedZone, sim);
      this._drawPurchaseLines(ctx, W, H, sim);
      this._drawDeliveryParticles(ctx, W, H, sim);
      this._drawFlashes(ctx, W, H, sim);
      this._drawTrustBar(ctx, W, H, sim);
      this._drawLegend(ctx, W, H);
    }
    
    _drawDebugMode(ctx, W, H, sim) {
      // Everything visible
      const leftZone = W * 0.12;
      const feedZone = W * 0.45;
      const rightZone = W * 0.88;
      const queueZone = W * 0.92;

      this._drawZoneLabels(ctx, W, H, leftZone, feedZone, rightZone, queueZone);
      this._drawSellers(ctx, W, H, rightZone, sim);
      this._drawFeed(ctx, W, H, leftZone, feedZone, sim);
      this._drawDeliveryQueue(ctx, W, H, feedZone, queueZone, sim);
      
      // All buyers visible
      this._drawAllBuyers(ctx, W, H, leftZone, sim);
      this._drawHeroBuyer(ctx, W, H, leftZone, sim);
      
      // All lines visible
      this._drawAllImpressionLines(ctx, W, H, leftZone, feedZone, sim);
      this._drawHeroLines(ctx, W, H, leftZone, feedZone, sim);
      this._drawPurchaseLines(ctx, W, H, sim);
      this._drawDeliveryParticles(ctx, W, H, sim);
      this._drawFlashes(ctx, W, H, sim);
      this._drawTrustBar(ctx, W, H, sim);
      this._drawLegend(ctx, W, H);
      
      // Debug labels
      this._drawDebugLabels(ctx, W, H, sim);
    }

    _drawBackground(ctx, W, H) {
      // Gradient background
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, 'rgba(11,18,32,0.95)');
      grad.addColorStop(1, 'rgba(3,7,18,0.98)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Grid
      ctx.strokeStyle = 'rgba(148,163,184,0.06)';
      ctx.lineWidth = 1;
      const step = 40;
      for (let x = 0; x <= W; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 0; y <= H; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
    }

    _drawBuyers(ctx, W, H, leftZone, sim) {
      // For explore mode: show limited buyers
      ctx.save();
      const visibleBuyers = sim.buyers.slice(-LIMITS.max_visible_buyers);
      for (let buyer of visibleBuyers) {
        if (buyer.id === sim.heroBuyerId) continue;
        
        const x = leftZone * buyer.x;
        const y = H * buyer.y;
        const size = 5;
        
        ctx.fillStyle = `rgba(96,165,250,${0.4 + buyer.trust * 0.2})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = `rgba(59,130,246,${0.3})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        
        if (buyer.intent === 'buy-intent') {
          ctx.fillStyle = 'rgba(52,211,153,0.6)';
          ctx.beginPath();
          ctx.arc(x, y - size - 2, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }
    
    _drawHeroBuyerLearn(ctx, W, H, sim) {
      if (!sim.heroBuyerId) return;
      const hero = sim.buyers.find(b => b.id === sim.heroBuyerId);
      if (!hero) return;
      
      ctx.save();
      const x = W * 0.15;
      const y = H * 0.5;
      const size = 10;
      
      // Halo
      const pulse = 1 + Math.sin(sim.time * 2) * 0.1;
      ctx.strokeStyle = `rgba(251,191,36,${0.6 * pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, size + 4, 0, Math.PI * 2);
      ctx.stroke();
      
      // Hero dot
      ctx.fillStyle = 'rgba(251,191,36,0.95)';
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = 'rgba(251,191,36,1)';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Label
      ctx.fillStyle = 'rgba(251,191,36,0.95)';
      ctx.font = 'bold 12px ui-sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('HERO', x, y - size - 8);
      
      ctx.restore();
    }
    
    _drawHeroCard(ctx, W, H, centerX, centerY, sim) {
      // Find hero's current/last viewed item
      if (!sim.heroBuyerId) {
        // Show placeholder if no hero
        ctx.save();
        ctx.fillStyle = 'rgba(15,23,42,0.6)';
        drawRoundedRect(ctx, centerX - 90, centerY - 60, 180, 120, 8);
        ctx.fill();
        ctx.strokeStyle = 'rgba(148,163,184,0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = 'rgba(229,231,235,0.5)';
        ctx.font = '12px ui-sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Waiting for hero...', centerX, centerY);
        ctx.restore();
        return;
      }
      
      const hero = sim.buyers.find(b => b.id === sim.heroBuyerId);
      if (!hero) return;
      
      // Find last impression or order
      let heroItem = null;
      let heroSlotIndex = null;
      for (let event of sim.heroEvents.slice().reverse()) {
        if (event.type === 'impression' || event.type === 'orderCreated') {
          heroSlotIndex = event.data.slotIndex;
          if (heroSlotIndex !== undefined && heroSlotIndex < sim.feed.length) {
            heroItem = sim.feed[heroSlotIndex].item;
            break;
          }
        }
      }
      
      // If no item, show first feed item
      if (!heroItem && sim.feed.length > 0 && sim.feed[0].item) {
        heroItem = sim.feed[0].item;
        heroSlotIndex = 0;
      }
      
      if (!heroItem) {
        // Show placeholder
        ctx.save();
        ctx.fillStyle = 'rgba(15,23,42,0.6)';
        drawRoundedRect(ctx, centerX - 90, centerY - 60, 180, 120, 8);
        ctx.fill();
        ctx.strokeStyle = 'rgba(148,163,184,0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = 'rgba(229,231,235,0.5)';
        ctx.font = '12px ui-sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Hero: browsing...', centerX, centerY);
        ctx.restore();
        return;
      }
      
      ctx.save();
      
      const cardW = 180;
      const cardH = 120;
      const x = centerX - cardW / 2;
      const y = centerY - cardH / 2;
      
      // Card background
      const quality = heroItem.quality;
      const color = qualityColor(quality);
      ctx.fillStyle = color;
      drawRoundedRect(ctx, x, y, cardW, cardH, 8);
      ctx.fill();
      
      // Border
      ctx.strokeStyle = 'rgba(251,191,36,0.9)';
      ctx.lineWidth = 3;
      ctx.stroke();
      
      // Content
      ctx.fillStyle = 'rgba(229,231,235,0.95)';
      ctx.font = 'bold 16px ui-monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`$${heroItem.price.toFixed(0)}`, centerX, y + 30);
      
      ctx.font = '14px ui-monospace';
      ctx.fillText(`Quality: ${quality.toFixed(2)}`, centerX, y + 50);
      
      if (sim.feed[heroSlotIndex] && sim.feed[heroSlotIndex].promoted) {
        ctx.fillStyle = 'rgba(251,191,36,0.95)';
        ctx.font = 'bold 12px ui-sans-serif';
        ctx.fillText('PROMOTED', centerX, y + 75);
      }
      
      // Label
      ctx.fillStyle = 'rgba(251,191,36,0.8)';
      ctx.font = '11px ui-sans-serif';
      ctx.fillText('HERO CARD', centerX, y - 8);
      
      ctx.restore();
    }
    
    _drawFeedList(ctx, W, H, listX, listY, sim) {
      ctx.save();
      
      const itemH = 20;
      const startY = listY - (sim.feed.length * itemH) / 2;
      
      // Background
      ctx.fillStyle = 'rgba(15,23,42,0.5)';
      drawRoundedRect(ctx, listX - 10, startY - 5, 160, sim.feed.length * itemH + 10, 6);
      ctx.fill();
      
      // Label
      ctx.fillStyle = 'rgba(229,231,235,0.7)';
      ctx.font = '10px ui-sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('FEED', listX, startY - 8);
      
      // Items
      for (let i = 0; i < sim.feed.length; i++) {
        const slot = sim.feed[i];
        const y = startY + i * itemH;
        
        // Highlight if recently viewed by hero
        const isHighlighted = sim.heroEvents.some(e => 
          e.type === 'impression' && e.data.slotIndex === i && (sim.time - e.t) < 1.0
        );
        
        // Check if clicked/ordered
        const isOrdered = sim.heroEvents.some(e => 
          e.type === 'orderCreated' && e.data.slotIndex === i
        );
        
        if (isOrdered) {
          ctx.fillStyle = 'rgba(251,191,36,0.4)';
          ctx.fillRect(listX - 8, y - 2, 156, itemH - 2);
        } else if (isHighlighted) {
          ctx.fillStyle = 'rgba(96,165,250,0.2)';
          ctx.fillRect(listX - 8, y - 2, 156, itemH - 2);
        }
        
        if (slot.item) {
          ctx.fillStyle = isOrdered ? 'rgba(251,191,36,0.95)' : 'rgba(229,231,235,0.9)';
          ctx.font = isOrdered ? 'bold 11px ui-monospace' : '11px ui-monospace';
          ctx.textAlign = 'left';
          const promo = slot.promoted ? ' PROMO' : '';
          ctx.fillText(`#${i + 1}  $${slot.item.price.toFixed(0)}  q${slot.item.quality.toFixed(2)}${promo}`, listX, y + 12);
        } else {
          ctx.fillStyle = 'rgba(148,163,184,0.4)';
          ctx.font = '10px ui-monospace';
          ctx.fillText(`#${i + 1}  —`, listX, y + 12);
        }
      }
      
      ctx.restore();
    }
    
    _drawDeliveryQueueStack(ctx, W, H, stackX, stackY, sim) {
      ctx.save();
      
      const maxVisible = Math.min(12, sim.delivery_queue.length);
      const cardW = 140;
      const cardH = 25;
      const spacing = 4;
      const startY = stackY - (maxVisible * (cardH + spacing)) / 2;
      
      // Background
      const p90eta = sim.ts.p90_eta.last() || 0;
      ctx.fillStyle = 'rgba(15,23,42,0.6)';
      drawRoundedRect(ctx, stackX - 10, startY - 25, cardW + 20, maxVisible * (cardH + spacing) + 30, 6);
      ctx.fill();
      
      // Header
      ctx.fillStyle = 'rgba(229,231,235,0.8)';
      ctx.font = '10px ui-sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`QUEUE (${sim.delivery_queue.length}) | P90 ETA ${U.formatSeconds(p90eta)}`, stackX, startY - 10);
      
      // Stack cards
      for (let i = 0; i < maxVisible; i++) {
        const order = sim.delivery_queue[i];
        if (!order) continue;
        
        const y = startY + i * (cardH + spacing);
        
        // Card background
        const progress = order.delivery_progress;
        const isDelivering = progress > 0.1;
        const isLate = order.late;
        
        if (isLate) {
          ctx.fillStyle = 'rgba(251,191,36,0.3)';
        } else if (isDelivering) {
          ctx.fillStyle = 'rgba(52,211,153,0.3)';
        } else {
          ctx.fillStyle = 'rgba(148,163,184,0.2)';
        }
        drawRoundedRect(ctx, stackX, y, cardW, cardH, 4);
        ctx.fill();
        
        // Border
        if (order.buyer.id === sim.heroBuyerId) {
          ctx.strokeStyle = 'rgba(251,191,36,0.8)';
          ctx.lineWidth = 2;
        } else {
          ctx.strokeStyle = 'rgba(148,163,184,0.4)';
          ctx.lineWidth = 1;
        }
        ctx.stroke();
        
        // Progress bar
        if (isDelivering) {
          ctx.fillStyle = 'rgba(52,211,153,0.7)';
          ctx.fillRect(stackX + 4, y + cardH - 6, (cardW - 8) * progress, 4);
        }
        
        // Price
        ctx.fillStyle = order.buyer.id === sim.heroBuyerId ? 'rgba(251,191,36,0.95)' : 'rgba(229,231,235,0.9)';
        ctx.font = order.buyer.id === sim.heroBuyerId ? 'bold 10px ui-monospace' : '10px ui-monospace';
        ctx.textAlign = 'left';
        const priceText = order.buyer.id === sim.heroBuyerId ? `HERO: $${order.price.toFixed(0)}` : `$${order.price.toFixed(0)}`;
        ctx.fillText(priceText, stackX + 6, y + 16);
        
        // Status
        ctx.font = '9px ui-sans-serif';
        ctx.textAlign = 'right';
        if (isLate) {
          ctx.fillStyle = 'rgba(251,191,36,0.9)';
          ctx.fillText('LATE', stackX + cardW - 6, y + 16);
        } else if (isDelivering) {
          ctx.fillStyle = 'rgba(52,211,153,0.9)';
          ctx.fillText('→', stackX + cardW - 6, y + 16);
        }
      }
      
      ctx.restore();
    }
    
    _drawCapacityWidget(ctx, W, H, x, y, sim) {
      ctx.save();
      
      const capacity = sim.params.capacity_deliveries_per_min;
      const queueLen = sim.delivery_queue.length;
      const load = capacity > 0 ? (queueLen / capacity) * 100 : 0;
      
      // Background
      ctx.fillStyle = 'rgba(15,23,42,0.6)';
      drawRoundedRect(ctx, x - 10, y - 10, 120, 50, 6);
      ctx.fill();
      
      // Text
      ctx.fillStyle = 'rgba(229,231,235,0.9)';
      ctx.font = '10px ui-sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`Capacity: ${capacity.toFixed(1)}/min`, x, y + 8);
      ctx.fillText(`Load: ${load.toFixed(0)}%`, x, y + 22);
      
      // Load bar
      const barW = 100;
      const barH = 4;
      ctx.fillStyle = 'rgba(148,163,184,0.2)';
      ctx.fillRect(x, y + 28, barW, barH);
      const loadW = Math.min(barW, barW * (load / 100));
      const loadColor = load > 80 ? 'rgba(251,113,133,0.8)' : load > 50 ? 'rgba(251,191,36,0.8)' : 'rgba(52,211,153,0.8)';
      ctx.fillStyle = loadColor;
      ctx.fillRect(x, y + 28, loadW, barH);
      
      ctx.restore();
    }
    
    _drawAllBuyers(ctx, W, H, leftZone, sim) {
      // Debug: show all buyers
      ctx.save();
      for (let buyer of sim.buyers) {
        if (buyer.id === sim.heroBuyerId) continue;
        
        const x = leftZone * buyer.x;
        const y = H * buyer.y;
        const size = 4;
        
        ctx.fillStyle = `rgba(96,165,250,${0.3})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    
    _drawAllImpressionLines(ctx, W, H, leftZone, feedZone, sim) {
      // Debug: show all impression lines
      ctx.save();
      for (let buyer of sim.buyers) {
        if (buyer.impressions === 0) continue;
        
        const buyerX = leftZone * buyer.x;
        const buyerY = H * buyer.y;
        const feedX = leftZone + (feedZone - leftZone) * 0.5;
        const feedY = H * 0.5;
        
        ctx.strokeStyle = 'rgba(96,165,250,0.1)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(buyerX, buyerY);
        ctx.lineTo(feedX, feedY);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();
    }
    
    _drawDebugLabels(ctx, W, H, sim) {
      ctx.save();
      ctx.fillStyle = 'rgba(251,113,133,0.8)';
      ctx.font = '10px ui-monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`DEBUG: ${sim.buyers.length} buyers, ${sim.orders.length} orders`, 10, H - 20);
      ctx.restore();
    }
    
    _drawHeroBuyer(ctx, W, H, leftZone, sim) {
      if (!sim.heroBuyerId) return;
      
      const hero = sim.buyers.find(b => b.id === sim.heroBuyerId);
      if (!hero) return;
      
      ctx.save();
      const x = leftZone * hero.x;
      const y = H * hero.y;
      const size = 8;
      
      // Halo (pulsing)
      const pulse = 1 + Math.sin(sim.time * 2) * 0.1;
      ctx.strokeStyle = `rgba(251,191,36,${0.6 * pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, size + 4, 0, Math.PI * 2);
      ctx.stroke();
      
      // Hero dot (bright)
      ctx.fillStyle = 'rgba(251,191,36,0.95)';
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
      
      // Outline
      ctx.strokeStyle = 'rgba(251,191,36,1)';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Label
      ctx.fillStyle = 'rgba(251,191,36,0.95)';
      ctx.font = 'bold 10px ui-sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('HERO', x, y - size - 6);
      
      ctx.restore();
    }
    
    _drawHeroLines(ctx, W, H, leftZone, feedZone, sim) {
      if (!sim.heroBuyerId) return;
      
      const hero = sim.buyers.find(b => b.id === sim.heroBuyerId);
      if (!hero) return;
      
      ctx.save();
      const heroX = leftZone * hero.x;
      const heroY = H * hero.y;
      const feedX = leftZone + (feedZone - leftZone) * 0.5;
      
      // Draw hero impression lines (dotted, fade out)
      for (let event of sim.heroEvents) {
        if (event.type === 'impression') {
          const age = sim.time - event.t;
          if (age > 0.5) continue;
          const alpha = 1 - age / 0.5;
          const slotIndex = event.data.slotIndex || 0;
          const feedY = (H / sim.feed.length) * (slotIndex + 0.5);
          
          ctx.strokeStyle = `rgba(96,165,250,${alpha * 0.4})`;
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(heroX, heroY);
          ctx.lineTo(feedX, feedY);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      
      // Draw hero order lines (solid, fade out)
      for (let line of sim.purchase_lines) {
        if (line.isHero && line.buyer.id === sim.heroBuyerId) {
          const age = sim.time - line.t0;
          if (age > line.ttl) continue;
          const alpha = 1 - age / line.ttl;
          const slotIndex = line.slotIndex || 0;
          const feedY = (H / sim.feed.length) * (slotIndex + 0.5);
          const queueX = feedZone + 20;
          const queueY = H * 0.75;
          
          // Line: hero → feed → queue
          ctx.strokeStyle = `rgba(251,191,36,${alpha * 0.8})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(heroX, heroY);
          ctx.lineTo(feedX, feedY);
          ctx.lineTo(queueX, queueY);
          ctx.stroke();
        }
      }
      
      ctx.restore();
    }
    
    _drawZoneLabels(ctx, W, H, leftZone, feedZone, rightZone, queueZone) {
      ctx.save();
      ctx.fillStyle = 'rgba(148,163,184,0.25)';
      ctx.font = '11px ui-sans-serif';
      ctx.textAlign = 'center';
      
      // BUYERS (left)
      ctx.fillText('BUYERS', leftZone * 0.5, H * 0.05);
      
      // FEED / RANKING (center)
      ctx.fillText('FEED / RANKING', leftZone + (feedZone - leftZone) * 0.5, H * 0.05);
      
      // DELIVERY QUEUE (below feed)
      ctx.fillText('DELIVERY QUEUE', feedZone + (queueZone - feedZone) * 0.5, H * 0.68);
      
      // SELLERS / CAPACITY (right)
      ctx.fillText('SELLERS / CAPACITY', rightZone + (W - rightZone) * 0.5, H * 0.05);
      
      ctx.restore();
    }

    _drawFeed(ctx, W, H, leftZone, feedZone, sim) {
      const feedX = leftZone;
      const feedW = feedZone - leftZone;
      const cols = 2;
      const rows = 4;
      const slotW = (feedW - 12) / cols;
      const slotH = (H - 12) / rows;
      
      ctx.save();
      
      // Feed background
      ctx.fillStyle = 'rgba(15,23,42,0.4)';
      drawRoundedRect(ctx, feedX, 0, feedW, H, 8);
      ctx.fill();
      
      // Draw slots in 2 columns
      for (let i = 0; i < sim.feed.length && i < 8; i++) {
        const slot = sim.feed[i];
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = feedX + 6 + col * (slotW + 4);
        const y = 6 + row * (slotH + 4);
        const slotPadding = 3;
        
        // Check for ping animation (recent purchase)
        const pingAge = slot.lastPurchaseTime ? sim.time - slot.lastPurchaseTime : 999;
        const pingAlpha = pingAge < 0.3 ? 1 - pingAge / 0.3 : 0;
        
        if (slot.item) {
          const item = slot.item;
          const quality = item.quality;
          const color = qualityColor(quality);
          
          // Card background
          ctx.fillStyle = color;
          drawRoundedRect(ctx, x + slotPadding, y + slotPadding, slotW - slotPadding * 2, slotH - slotPadding * 2, 4);
          ctx.fill();
          
          // Border (thicker if promoted, ping if recent purchase)
          if (pingAlpha > 0) {
            ctx.strokeStyle = `rgba(251,191,36,${pingAlpha})`;
            ctx.lineWidth = 3;
          } else {
            ctx.strokeStyle = slot.promoted ? 'rgba(251,191,36,0.8)' : 'rgba(148,163,184,0.3)';
            ctx.lineWidth = slot.promoted ? 2 : 1;
          }
          ctx.stroke();
          
          // Item info (larger text)
          ctx.fillStyle = 'rgba(229,231,235,0.95)';
          ctx.font = 'bold 11px ui-monospace';
          ctx.textAlign = 'left';
          ctx.fillText(`$${item.price.toFixed(0)}`, x + slotPadding + 4, y + slotPadding + 14);
          ctx.font = '10px ui-monospace';
          ctx.fillText(`q:${quality.toFixed(2)}`, x + slotPadding + 4, y + slotPadding + 26);
          
          // Promoted badge
          if (slot.promoted) {
            ctx.fillStyle = 'rgba(251,191,36,0.95)';
            ctx.font = 'bold 8px ui-sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText('PROMO', x + slotW - slotPadding - 4, y + slotPadding + 10);
          }
        } else {
          // Empty slot
          ctx.strokeStyle = 'rgba(148,163,184,0.15)';
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 2]);
          drawRoundedRect(ctx, x + slotPadding, y + slotPadding, slotW - slotPadding * 2, slotH - slotPadding * 2, 4);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      
      ctx.restore();
    }

    _drawSellers(ctx, W, H, rightZone, sim) {
      ctx.save();
      const sellerCount = Math.min(sim.sellers.length, 20); // Limit visible
      const spacing = H / (sellerCount + 1);
      
      for (let i = 0; i < sellerCount; i++) {
        const seller = sim.sellers[i];
        const x = rightZone;
        const y = spacing * (i + 1);
        const size = 5;
        
        // Seller dot (color by quality)
        const color = qualityColor(seller.quality);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
        
        // Outline
        ctx.strokeStyle = 'rgba(148,163,184,0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      
      ctx.restore();
    }

    _drawDeliveryQueue(ctx, W, H, feedZone, queueZone, sim) {
      ctx.save();
      
      const queueX = feedZone + 10;
      const queueW = queueZone - feedZone - 20;
      const queueY = H * 0.72;
      const queueH = H * 0.24;
      
      // Queue background
      ctx.fillStyle = 'rgba(15,23,42,0.6)';
      drawRoundedRect(ctx, queueX, queueY, queueW, queueH, 6);
      ctx.fill();
      
      // Queue header
      const p90eta = sim.ts.p90_eta.last() || 0;
      const capacity = sim.params.capacity_deliveries_per_min;
      ctx.fillStyle = 'rgba(229,231,235,0.8)';
      ctx.font = '10px ui-sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`Queue: ${sim.delivery_queue.length} | P90 ETA: ${U.formatSeconds(p90eta)} | Capacity: ${capacity.toFixed(1)}/min`, queueX + 8, queueY + 14);
      
      // Queue items (vertical stack)
      const maxVisible = Math.min(20, sim.delivery_queue.length);
      const visible = sim.delivery_queue.slice(0, maxVisible);
      const itemH = Math.min(8, (queueH - 20) / maxVisible);
      const itemSpacing = itemH + 2;
      
      for (let i = 0; i < visible.length; i++) {
        const order = visible[i];
        const x = queueX + 8;
        const y = queueY + 20 + i * itemSpacing;
        const itemW = queueW - 16;
        
        // Order rectangle (color by progress)
        const progress = order.delivery_progress;
        const r = Math.round(U.lerp(251, 52, progress));
        const g = Math.round(U.lerp(191, 211, progress));
        const b = Math.round(U.lerp(36, 153, progress));
        ctx.fillStyle = `rgba(${r},${g},${b},0.7)`;
        ctx.fillRect(x, y, itemW * progress, itemH);
        
        // Background (unfilled)
        ctx.fillStyle = 'rgba(148,163,184,0.2)';
        ctx.fillRect(x + itemW * progress, y, itemW * (1 - progress), itemH);
        
        // Border
        ctx.strokeStyle = 'rgba(148,163,184,0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, itemW, itemH);
        
        // Late marker (yellow dot on right)
        if (order.late) {
          ctx.fillStyle = 'rgba(251,191,36,0.9)';
          ctx.beginPath();
          ctx.arc(x + itemW - 4, y + itemH / 2, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        
        // Hero order highlight
        if (order.buyer.id === sim.heroBuyerId) {
          ctx.strokeStyle = 'rgba(251,191,36,0.8)';
          ctx.lineWidth = 2;
          ctx.strokeRect(x - 1, y - 1, itemW + 2, itemH + 2);
        }
      }
      
      ctx.restore();
    }

    _drawPurchaseLines(ctx, W, H, sim) {
      ctx.save();
      
      // Only draw non-hero lines (hero drawn separately)
      for (let line of sim.purchase_lines) {
        if (line.isHero) continue; // Skip hero lines
        
        const age = sim.time - line.t0;
        const alpha = Math.max(0, 1 - age / line.ttl);
        
        if (alpha <= 0) continue;
        
        // Line from buyer to feed
        const leftZone = W * 0.12;
        const feedZone = W * 0.45;
        const buyerX = leftZone * line.buyer.x;
        const buyerY = H * line.buyer.y;
        const feedX = leftZone + (feedZone - leftZone) * 0.5;
        const slotIndex = line.slotIndex || 0;
        const feedY = (H / sim.feed.length) * (slotIndex + 0.5);
        
        ctx.strokeStyle = `rgba(96,165,250,${alpha * 0.3})`;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(buyerX, buyerY);
        ctx.lineTo(feedX, feedY);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      
      ctx.restore();
    }

    _drawDeliveryParticles(ctx, W, H, sim) {
      ctx.save();
      
      const leftZone = W * 0.12;
      const feedZone = W * 0.45;
      const queueX = feedZone + 10;
      const queueY = H * 0.75;
      
      for (let order of sim.delivery_queue) {
        if (order.delivered || order.cancelled) continue;
        
        // Delivery particle (moving point)
        const progress = order.delivery_progress;
        const startX = queueX;
        const startY = queueY;
        const endX = leftZone * order.buyer.x;
        const endY = H * order.buyer.y;
        
        const x = U.lerp(startX, endX, progress);
        const y = U.lerp(startY, endY, progress);
        
        // Hero delivery is brighter
        const isHero = order.buyer.id === sim.heroBuyerId;
        const size = isHero ? 5 : 4;
        const color = isHero ? 'rgba(251,191,36,0.95)' : 'rgba(52,211,153,0.9)';
        
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
        
        // Trail (lighter for hero)
        ctx.strokeStyle = isHero ? 'rgba(251,191,36,0.4)' : 'rgba(52,211,153,0.3)';
        ctx.lineWidth = isHero ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      
      ctx.restore();
    }

    _drawFlashes(ctx, W, H, sim) {
      ctx.save();
      
      // Cancel flashes (red cross)
      for (let flash of sim.cancel_flashes) {
        const age = sim.time - flash.t0;
        const alpha = Math.max(0, 1 - age / flash.ttl);
        if (alpha <= 0) continue;
        
        const x = flash.x * W;
        const y = flash.y * H;
        const size = 8;
        
        ctx.strokeStyle = `rgba(251,113,133,${alpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - size, y - size);
        ctx.lineTo(x + size, y + size);
        ctx.moveTo(x + size, y - size);
        ctx.lineTo(x - size, y + size);
        ctx.stroke();
      }
      
      // Delivered flashes (green burst)
      for (let flash of sim.delivered_flashes) {
        const age = sim.time - flash.t0;
        const alpha = Math.max(0, 1 - age / flash.ttl);
        if (alpha <= 0) continue;
        
        const x = flash.x * W;
        const y = flash.y * H;
        const size = 6 + age * 10;
        
        ctx.fillStyle = `rgba(52,211,153,${alpha * 0.5})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.restore();
    }

    _drawTrustBar(ctx, W, H, sim) {
      ctx.save();
      
      const barX = W * 0.05;
      const barY = H * 0.05;
      const barW = 120;
      const barH = 6;
      
      // Background
      ctx.fillStyle = 'rgba(15,23,42,0.6)';
      ctx.fillRect(barX, barY, barW, barH);
      
      // Trust fill
      const trust = U.clamp(sim.trust, 0, 1);
      const fillW = barW * trust;
      const r = Math.round(U.lerp(251, 52, trust));
      const g = Math.round(U.lerp(113, 211, trust));
      const b = Math.round(U.lerp(133, 153, trust));
      ctx.fillStyle = `rgba(${r},${g},${b},0.9)`;
      ctx.fillRect(barX, barY, fillW, barH);
      
      // Label
      ctx.fillStyle = 'rgba(229,231,235,0.8)';
      ctx.font = '10px ui-sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Trust', barX, barY - 4);
      ctx.fillText(`${(trust * 100).toFixed(0)}%`, barX + barW + 8, barY + 5);
      
      ctx.restore();
    }

    _drawLegend(ctx, W, H) {
      ctx.save();
      
      const legendX = W - 200;
      const legendY = H - 160;
      
      ctx.fillStyle = 'rgba(15,23,42,0.75)';
      ctx.fillRect(legendX, legendY, 190, 150);
      
      ctx.fillStyle = 'rgba(229,231,235,0.9)';
      ctx.font = '10px ui-sans-serif';
      ctx.textAlign = 'left';
      
      let y = legendY + 15;
      ctx.fillText('Legend:', legendX + 8, y);
      y += 15;
      
      // Hero
      ctx.fillStyle = 'rgba(251,191,36,0.95)';
      ctx.beginPath();
      ctx.arc(legendX + 8, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(251,191,36,1)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = 'rgba(229,231,235,0.9)';
      ctx.fillText('Hero buyer', legendX + 18, y + 4);
      y += 15;
      
      // Buyers
      ctx.fillStyle = 'rgba(96,165,250,0.6)';
      ctx.beginPath();
      ctx.arc(legendX + 8, y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(229,231,235,0.8)';
      ctx.fillText('Buyers', legendX + 18, y + 4);
      y += 15;
      
      // Dotted line (impression)
      ctx.strokeStyle = 'rgba(96,165,250,0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(legendX + 5, y);
      ctx.lineTo(legendX + 15, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(229,231,235,0.8)';
      ctx.fillText('Dotted = impression', legendX + 18, y + 4);
      y += 15;
      
      // Solid line (order)
      ctx.strokeStyle = 'rgba(251,191,36,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(legendX + 5, y);
      ctx.lineTo(legendX + 15, y);
      ctx.stroke();
      ctx.fillStyle = 'rgba(229,231,235,0.8)';
      ctx.fillText('Solid = order', legendX + 18, y + 4);
      y += 15;
      
      // Moving dot (delivery)
      ctx.fillStyle = 'rgba(52,211,153,0.9)';
      ctx.beginPath();
      ctx.arc(legendX + 8, y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(229,231,235,0.8)';
      ctx.fillText('Moving dot = delivery', legendX + 18, y + 4);
      y += 15;
      
      // Yellow mark (late)
      ctx.fillStyle = 'rgba(251,191,36,0.9)';
      ctx.beginPath();
      ctx.arc(legendX + 8, y, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(229,231,235,0.8)';
      ctx.fillText('Yellow = late', legendX + 18, y + 4);
      y += 15;
      
      // Red X (cancel)
      ctx.strokeStyle = 'rgba(251,113,133,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(legendX + 5, y - 3);
      ctx.lineTo(legendX + 13, y + 5);
      ctx.moveTo(legendX + 13, y - 3);
      ctx.lineTo(legendX + 5, y + 5);
      ctx.stroke();
      ctx.fillStyle = 'rgba(229,231,235,0.8)';
      ctx.fillText('Red X = cancel', legendX + 18, y + 4);
      
      ctx.restore();
    }
  }

  function createRenderer({ mainCanvas }) {
    return new Renderer({ mainCanvas });
  }

  window.Render = { createRenderer };
})();
