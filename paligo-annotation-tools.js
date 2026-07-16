(function initPaligoAnnotationTools(global) {
  'use strict';

  const VERSION = '0.1.0';
  const SCHEMA = 'paligo.annotation.v1';
  const STORAGE_KEYS = {
    reviewLegacy: 'paligo-corpus-review-notes-v1',
    remarkLegacy: 'paligo-corpus-remarks-v1',
    examActiveLegacy: 'paligo-reference-pip-active-exam-id-v1',
    scopedPrefix: 'paligo.annotations.v1',
  };

  const grammarTags = Object.freeze([
    { id: 'b-p', label: 'ป.', title: 'ประธาน', className: 'b-p' },
    { id: 'b-v-kit', label: 'กก.', title: 'กิริยากิตก์', className: 'b-v-kit' },
    { id: 'b-v-akhyat', label: 'กอ.', title: 'กิริยาอาขยาต', className: 'b-v-akhyat' },
    { id: 'b-v1', label: 'ป.วิภ.', title: 'ปฐมา วิภัตติ', className: 'b-v1' },
    { id: 'b-v2', label: 'ทุ.วิภ.', title: 'ทุติยา วิภัตติ', className: 'b-v2' },
    { id: 'b-v3', label: 'ต.วิภ.', title: 'ตติยา วิภัตติ', className: 'b-v3_7' },
    { id: 'b-v4', label: 'จต.วิภ.', title: 'จตุตถี วิภัตติ', className: 'b-v3_7' },
    { id: 'b-v5', label: 'ปญฺ.วิภ.', title: 'ปัญจมี วิภัตติ', className: 'b-v3_7' },
    { id: 'b-v6', label: 'ฉ.วิภ.', title: 'ฉัฏฐี วิภัตติ', className: 'b-v3_7' },
    { id: 'b-v7', label: 'สตฺ.วิภ.', title: 'สัตตมี วิภัตติ', className: 'b-v3_7' },
    { id: 'b-sing', label: 'เอก.', title: 'เอกวจนะ', className: 'b-sing' },
    { id: 'b-plur', label: 'พหุ.', title: 'พหุวจนะ', className: 'b-plur' },
    { id: 'b-special1', label: 'หัก ฉ.ทุ.', title: 'หัก ฉ.ทุ.', className: 'b-special1' },
  ]);

  const remarkShapes = Object.freeze([
    { id: 'circle', label: 'วงกลม', title: 'วงกลมธรรมดา', className: 'is-circle' },
    { id: 'circle-double', label: 'วงกลม ๒ ชั้น', title: 'วงกลมซ้อนทับสองชั้น', className: 'is-circle-double' },
    {
      id: 'brackets',
      label: 'ใส่วงเล็บ ()',
      title: 'เลือกช่วงข้อความแล้วใส่วงเล็บเปิดและปิด',
      help: 'เลือกระยะข้อความที่ต้องการใส่วงเล็บและกดปุ่ม "ใส่วงเล็บ ()"',
      className: 'is-brackets',
    },
  ]);

  const pt4PaliGrammarPreset = Object.freeze({
    presetId: 'pt4-pali-grammar',
    label: 'ป.ธ. ๔ · บาลีไวยากรณ์',
    features: Object.freeze(['memory', 'grammar-tag', 'shape', 'report', 'exam-boundary']),
    grammarTags,
    remarkShapes,
  });

  function cloneTool(tool) {
    return { ...tool };
  }

  function simpleHash(value) {
    let hash = 0;
    const text = String(value || '');
    for (let index = 0; index < text.length; index += 1) {
      hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
    }
    return Math.abs(hash).toString(36);
  }

  function reviewKey(target = {}) {
    return [
      target.corpusId || '',
      target.itemId || '',
      target.sourcePage || '',
      target.khoNo || '',
      target.selectionId || '',
    ].join('::');
  }

  function remarkKey(target = {}) {
    return [
      target.corpusId || '',
      target.itemId || '',
      target.selectionId || '',
      target.toolId || '',
    ].join('::');
  }

  function examDateStamp(date = new Date()) {
    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yy}${mm}${dd}`;
  }

  function nextExamQuestionId(notes = [], date = new Date()) {
    const prefix = `EX-${examDateStamp(date)}-`;
    const maxSequence = notes.reduce((max, note) => {
      const value = String(note?.examQuestionId || '');
      if (!value.startsWith(prefix)) return max;
      const sequence = Number(value.slice(prefix.length));
      return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
    }, 0);
    return `${prefix}${String(maxSequence + 1).padStart(3, '0')}`;
  }

  function allRemarkTools(preset = pt4PaliGrammarPreset) {
    return [
      ...(preset.grammarTags || []).map((tool) => ({ ...cloneTool(tool), toolType: 'grammar' })),
      ...(preset.remarkShapes || []).map((tool) => ({ ...cloneTool(tool), toolType: 'shape' })),
    ];
  }

  function scopedStorageKey(kind, context = {}) {
    const course = context.courseId || 'course';
    const subject = context.subjectId || 'subject';
    const corpus = context.corpusId || context.manifestPath || 'corpus';
    return [STORAGE_KEYS.scopedPrefix, course, subject, corpus, kind].map((part) => String(part).replace(/[:\s]+/g, '-')).join(':');
  }

  function readJsonArray(key, fallback = []) {
    try {
      const parsed = JSON.parse(global.localStorage.getItem(key) || '[]');
      return Array.isArray(parsed) ? parsed : fallback;
    } catch (_error) {
      return fallback;
    }
  }

  function writeJsonArray(key, value) {
    global.localStorage.setItem(key, JSON.stringify(Array.isArray(value) ? value : []));
  }

  global.PaligoAnnotationTools = Object.freeze({
    VERSION,
    SCHEMA,
    storageKeys: Object.freeze({ ...STORAGE_KEYS }),
    presets: Object.freeze({
      pt4PaliGrammar: pt4PaliGrammarPreset,
      allRemarkTools,
    }),
    keys: Object.freeze({
      review: reviewKey,
      remark: remarkKey,
      scopedStorage: scopedStorageKey,
    }),
    storage: Object.freeze({
      readJsonArray,
      writeJsonArray,
    }),
    exam: Object.freeze({
      dateStamp: examDateStamp,
      nextQuestionId: nextExamQuestionId,
    }),
    simpleHash,
  });
})(window);
