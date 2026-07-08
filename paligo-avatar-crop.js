/**
 * Square avatar crop modal — drag to position, zoom, then save.
 */
(function (global) {
  const CROP_FRAME_PX = 280;
  const ZOOM_RANGE = 2;
  const MAX_FILE_BYTES = 2 * 1024 * 1024;

  let modalRoot = null;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function readImageFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("อ่านไฟล์รูปไม่สำเร็จ"));
      reader.readAsDataURL(file);
    });
  }

  function loadImageElement(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("โหลดรูปไม่สำเร็จ"));
      img.src = src;
    });
  }

  function getBaseScale(img) {
    return Math.max(CROP_FRAME_PX / img.naturalWidth, CROP_FRAME_PX / img.naturalHeight);
  }

  function getDisplayScale(img, zoomFactor) {
    return getBaseScale(img) * (1 + zoomFactor * ZOOM_RANGE);
  }

  function clampOffsets(img, scale, offsetX, offsetY) {
    const displayW = img.naturalWidth * scale;
    const displayH = img.naturalHeight * scale;
    let nextX = offsetX;
    let nextY = offsetY;

    if (displayW > CROP_FRAME_PX) {
      const minX = CROP_FRAME_PX / 2 - displayW / 2;
      const maxX = displayW / 2 - CROP_FRAME_PX / 2;
      nextX = clamp(offsetX, minX, maxX);
    } else {
      nextX = 0;
    }

    if (displayH > CROP_FRAME_PX) {
      const minY = CROP_FRAME_PX / 2 - displayH / 2;
      const maxY = displayH / 2 - CROP_FRAME_PX / 2;
      nextY = clamp(offsetY, minY, maxY);
    } else {
      nextY = 0;
    }

    return { offsetX: nextX, offsetY: nextY };
  }

  function applyImageTransform(imgEl, img, scale, offsetX, offsetY) {
    const displayW = img.naturalWidth * scale;
    const displayH = img.naturalHeight * scale;
    const left = CROP_FRAME_PX / 2 - displayW / 2 + offsetX;
    const top = CROP_FRAME_PX / 2 - displayH / 2 + offsetY;
    imgEl.style.width = `${displayW}px`;
    imgEl.style.height = `${displayH}px`;
    imgEl.style.left = `${left}px`;
    imgEl.style.top = `${top}px`;
  }

  function exportCrop(img, scale, offsetX, offsetY) {
    const displayW = img.naturalWidth * scale;
    const displayH = img.naturalHeight * scale;
    const imgLeft = CROP_FRAME_PX / 2 - displayW / 2 + offsetX;
    const imgTop = CROP_FRAME_PX / 2 - displayH / 2 + offsetY;
    const srcX = clamp(-imgLeft / scale, 0, img.naturalWidth);
    const srcY = clamp(-imgTop / scale, 0, img.naturalHeight);
    const srcSize = Math.min(CROP_FRAME_PX / scale, img.naturalWidth - srcX, img.naturalHeight - srcY);
    const profile = global.PaligoProfile;
    if (!profile?.encodeSquareAvatar) {
      throw new Error("ระบบประมวลผลรูปไม่พร้อม");
    }
    return profile.encodeSquareAvatar(img, srcX, srcY, srcSize);
  }

  function ensureModal() {
    if (modalRoot) return modalRoot;

    modalRoot = document.createElement("div");
    modalRoot.className = "paligo-modal-backdrop avatar-crop-modal";
    modalRoot.hidden = true;
    modalRoot.innerHTML = `
      <div class="paligo-modal avatar-crop-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="avatar-crop-title">
        <h2 class="paligo-modal__title" id="avatar-crop-title">ครอปรูปโปรไฟล์</h2>
        <p class="paligo-modal__body avatar-crop-modal__hint">ลากเพื่อจัดตำแหน่ง · ปรับซูมให้ใบหน้าอยู่กลางวงกลม</p>
        <div class="avatar-crop-stage" data-avatar-crop-stage>
          <div class="avatar-crop-frame">
            <img data-avatar-crop-img alt="" draggable="false" />
            <div class="avatar-crop-mask" aria-hidden="true"></div>
          </div>
        </div>
        <label class="avatar-crop-zoom-label">
          <span>ซูม</span>
          <input type="range" min="0" max="100" value="0" data-avatar-crop-zoom />
        </label>
        <div class="paligo-modal__actions is-row">
          <button type="button" class="paligo-btn is-ghost" data-avatar-crop-cancel>ยกเลิก</button>
          <button type="button" class="paligo-btn is-primary" data-avatar-crop-save>ใช้รูปนี้</button>
        </div>
      </div>
    `;
    document.body.append(modalRoot);
    return modalRoot;
  }

  function closeModal() {
    if (!modalRoot) return;
    modalRoot.hidden = true;
    document.body.classList.remove("is-avatar-crop-open");
  }

  async function open(file) {
    if (!file || !String(file.type || "").startsWith("image/")) {
      throw new Error("เลือกไฟล์รูปภาพ (JPEG/PNG/WebP)");
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new Error("รูปใหญ่เกินไป — ใช้ไฟล์ไม่เกิน 2 MB");
    }

    const raw = await readImageFile(file);
    const img = await loadImageElement(raw);
    const modal = ensureModal();
    const imgEl = modal.querySelector("[data-avatar-crop-img]");
    const stage = modal.querySelector("[data-avatar-crop-stage]");
    const zoomInput = modal.querySelector("[data-avatar-crop-zoom]");
    const saveButton = modal.querySelector("[data-avatar-crop-save]");
    const cancelButton = modal.querySelector("[data-avatar-crop-cancel]");

    let zoomFactor = 0;
    let offsetX = 0;
    let offsetY = 0;
    let dragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragOriginX = 0;
    let dragOriginY = 0;

    const render = () => {
      const scale = getDisplayScale(img, zoomFactor);
      const clamped = clampOffsets(img, scale, offsetX, offsetY);
      offsetX = clamped.offsetX;
      offsetY = clamped.offsetY;
      applyImageTransform(imgEl, img, scale, offsetX, offsetY);
    };

    const setZoomFactor = (value) => {
      zoomFactor = clamp(value, 0, 1);
      zoomInput.value = String(Math.round(zoomFactor * 100));
      render();
    };

    imgEl.src = raw;
    setZoomFactor(0);
    modal.hidden = false;
    document.body.classList.add("is-avatar-crop-open");
    saveButton.disabled = false;

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        stage.removeEventListener("pointerdown", onPointerDown);
        stage.removeEventListener("pointermove", onPointerMove);
        stage.removeEventListener("pointerup", onPointerUp);
        stage.removeEventListener("pointercancel", onPointerUp);
        zoomInput.removeEventListener("input", onZoomInput);
        saveButton.removeEventListener("click", onSave);
        cancelButton.removeEventListener("click", onCancel);
        modal.removeEventListener("click", onBackdropClick);
        document.removeEventListener("keydown", onKeydown);
        closeModal();
      };

      const finishResolve = (value) => {
        cleanup();
        resolve(value);
      };

      const finishReject = (error) => {
        cleanup();
        reject(error);
      };

      const onPointerDown = (event) => {
        if (event.button !== 0) return;
        dragging = true;
        dragStartX = event.clientX;
        dragStartY = event.clientY;
        dragOriginX = offsetX;
        dragOriginY = offsetY;
        stage.setPointerCapture(event.pointerId);
        stage.classList.add("is-dragging");
      };

      const onPointerMove = (event) => {
        if (!dragging) return;
        offsetX = dragOriginX + (event.clientX - dragStartX);
        offsetY = dragOriginY + (event.clientY - dragStartY);
        render();
      };

      const onPointerUp = (event) => {
        if (!dragging) return;
        dragging = false;
        stage.classList.remove("is-dragging");
        try {
          stage.releasePointerCapture(event.pointerId);
        } catch {
          /* ignore */
        }
      };

      const onZoomInput = () => {
        setZoomFactor(Number(zoomInput.value) / 100);
      };

      const onSave = async () => {
        try {
          saveButton.disabled = true;
          const scale = getDisplayScale(img, zoomFactor);
          const dataUrl = exportCrop(img, scale, offsetX, offsetY);
          finishResolve(dataUrl);
        } catch (error) {
          finishReject(error);
        }
      };

      const onCancel = () => {
        finishResolve(null);
      };

      const onBackdropClick = (event) => {
        if (event.target === modal) onCancel();
      };

      const onKeydown = (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      };

      stage.addEventListener("pointerdown", onPointerDown);
      stage.addEventListener("pointermove", onPointerMove);
      stage.addEventListener("pointerup", onPointerUp);
      stage.addEventListener("pointercancel", onPointerUp);
      zoomInput.addEventListener("input", onZoomInput);
      saveButton.addEventListener("click", onSave);
      cancelButton.addEventListener("click", onCancel);
      modal.addEventListener("click", onBackdropClick);
      document.addEventListener("keydown", onKeydown);
    });
  }

  global.PaligoAvatarCrop = { open };
})(typeof window !== "undefined" ? window : globalThis);
