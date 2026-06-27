/* ============================================================
   CV BOOSTER PRO — Pad de signature
   Permet de dessiner une signature à la souris ou au doigt sur un
   <canvas>, et de l'exporter en image PNG (base64) stockée dans un
   champ caché du formulaire (#signatureDataInput).
   ============================================================ */

const SignaturePad = (() => {

  let canvas, ctx;
  let drawing = false;
  let hasDrawn = false;
  let lastX = 0, lastY = 0;

  /**
   * Initialise le pad sur le canvas présent dans le container donné.
   * Doit être appelé chaque fois que la section signature est (re)rendue,
   * car le canvas est recréé dans le DOM à chaque navigation de section.
   */
  function init(containerEl) {
    canvas = containerEl.querySelector("#signatureCanvas");
    if (!canvas) return;

    ctx = canvas.getContext("2d");
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1a1a1a";

    const hiddenInput = containerEl.querySelector("#signatureDataInput");
    const placeholder = containerEl.querySelector("#signaturePlaceholder");
    const clearBtn = containerEl.querySelector("#signatureClearBtn");
    const statusEl = containerEl.querySelector("#signatureStatus");

    hasDrawn = false;

    // Si une signature existait déjà (retour en arrière dans le formulaire),
    // on la réaffiche sur le canvas.
    if (hiddenInput && hiddenInput.value) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        hasDrawn = true;
        if (placeholder) placeholder.style.display = "none";
      };
      img.src = hiddenInput.value;
    } else if (placeholder) {
      placeholder.style.display = "block";
    }

    function getPos(evt) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      if (evt.touches && evt.touches.length > 0) {
        return {
          x: (evt.touches[0].clientX - rect.left) * scaleX,
          y: (evt.touches[0].clientY - rect.top) * scaleY
        };
      }
      return {
        x: (evt.clientX - rect.left) * scaleX,
        y: (evt.clientY - rect.top) * scaleY
      };
    }

    function startDraw(evt) {
      evt.preventDefault();
      drawing = true;
      const pos = getPos(evt);
      lastX = pos.x;
      lastY = pos.y;
      if (placeholder) placeholder.style.display = "none";
    }

    function moveDraw(evt) {
      if (!drawing) return;
      evt.preventDefault();
      const pos = getPos(evt);
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      lastX = pos.x;
      lastY = pos.y;
      hasDrawn = true;
    }

    function endDraw(evt) {
      if (drawing) saveToInput();
      drawing = false;
    }

    function saveToInput() {
      if (hiddenInput) {
        hiddenInput.value = canvas.toDataURL("image/png");
        if (statusEl) statusEl.textContent = "";
        canvas.classList.remove("signature-error");
        // Déclenche un événement "input" pour que l'autosave du formulaire
        // (qui écoute "input" sur le container) se déclenche normalement.
        hiddenInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }

    // Souris
    canvas.addEventListener("mousedown", startDraw);
    canvas.addEventListener("mousemove", moveDraw);
    canvas.addEventListener("mouseup", endDraw);
    canvas.addEventListener("mouseleave", endDraw);

    // Tactile
    canvas.addEventListener("touchstart", startDraw, { passive: false });
    canvas.addEventListener("touchmove", moveDraw, { passive: false });
    canvas.addEventListener("touchend", endDraw);

    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        hasDrawn = false;
        if (hiddenInput) hiddenInput.value = "";
        if (placeholder) placeholder.style.display = "block";
      });
    }
  }

  return { init };
})();
