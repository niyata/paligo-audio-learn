/**
 * Date picker แบบหัวกระดาษสมุดข้อสอบ (วัน · เดือน · พ.ศ.)
 * ใช้ร่วมกับ paligo-exam-picker.css
 */
(function (global) {
  const THAI_MONTH_NAMES = [
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม",
  ];

  function defaultToThaiNumber(value) {
    const map = { 0: "๐", 1: "๑", 2: "๒", 3: "๓", 4: "๔", 5: "๕", 6: "๖", 7: "๗", 8: "๘", 9: "๙" };
    return String(value).replace(/\d/g, (digit) => map[digit] || digit);
  }

  function normalizeExamDateKeys(input) {
    const keys = new Set();
    (input || []).forEach((key) => {
      if (key && key !== "__unknown__") keys.add(String(key));
    });
    return keys;
  }

  function optionHasExam(pickerType, value, values, examDateKeys) {
    if (!examDateKeys.size) return false;

    const selectedYear = values.year ? String(values.year) : "";
    const selectedMonth = values.month ? String(values.month).padStart(2, "0") : "";

    if (pickerType === "year") {
      const year = String(value);
      for (const key of examDateKeys) {
        if (key.startsWith(`${year}-`)) return true;
      }
      return false;
    }

    if (pickerType === "month") {
      const month = String(value).padStart(2, "0");
      for (const key of examDateKeys) {
        const [year, monthPart] = key.split("-");
        if (selectedYear && year !== selectedYear) continue;
        if (monthPart === month) return true;
      }
      return false;
    }

    const day = String(value).padStart(2, "0");
    for (const key of examDateKeys) {
      const [year, monthPart, dayPart] = key.split("-");
      if (selectedYear && year !== selectedYear) continue;
      if (selectedMonth && monthPart !== selectedMonth) continue;
      if (dayPart === day) return true;
    }
    return false;
  }

  function getTodayParts(referenceDate = new Date()) {
    return {
      day: String(referenceDate.getDate()),
      month: String(referenceDate.getMonth() + 1),
      year: String(referenceDate.getFullYear() + 543),
    };
  }

  /** ไฮไลท์วันนี้ตามบริบทปี/เดือนที่เลือก */
  function isTodayPart(pickerType, value, values, today = getTodayParts()) {
    if (pickerType === "year") return String(value) === today.year;

    const contextYear = values.year || today.year;
    if (pickerType === "month") {
      if (contextYear !== today.year) return false;
      return String(value) === today.month;
    }

    const contextMonth = values.month || today.month;
    if (contextYear !== today.year || contextMonth !== today.month) return false;
    return String(value) === today.day;
  }

  function buildPickerShell(type, { yearWindow = 4 } = {}) {
    const picker = document.createElement("div");
    picker.className = "exam-picker";
    picker.dataset.examPicker = type;
    if (type === "day") {
      picker.dataset.min = "1";
      picker.dataset.max = "31";
    }
    if (type === "year") {
      picker.dataset.yearWindow = String(yearWindow);
    }

    const triggerClass =
      type === "day" ? "exam-date-day" : type === "month" ? "exam-date-month" : "exam-date-year";
    const title = type === "day" ? "วันที่" : type === "month" ? "เดือน" : "พ.ศ.";
    const placeholder = type === "month" ? "......." : ".......";

    picker.innerHTML = `
      <button
        class="exam-picker-trigger ${triggerClass}"
        type="button"
        aria-haspopup="listbox"
        aria-expanded="false"
      >
        <span class="picker-value" data-picker-value></span>
        <span class="picker-placeholder" data-picker-placeholder>${placeholder}</span>
      </button>
      <div class="exam-picker-popover" data-picker-popover hidden>
        <div class="exam-picker-title">${title}</div>
        <div class="exam-picker-grid${
          type === "month" ? " exam-month-grid" : type === "year" ? " exam-year-grid" : ""
        }" data-picker-options></div>
      </div>`;
    return picker;
  }

  function mount(root, options = {}) {
    if (!root) return null;

    const toThaiNumber = options.toThaiNumber || defaultToThaiNumber;
    const onChange = typeof options.onChange === "function" ? options.onChange : () => {};
    const yearWindow = Number(options.yearWindow || 4);
    const yearMin = Number.isFinite(options.yearMin) ? Number(options.yearMin) : null;
    const yearMax = Number.isFinite(options.yearMax) ? Number(options.yearMax) : null;
    let examDateKeys = normalizeExamDateKeys(options.examDateKeys);

    root.replaceChildren();
    const line = document.createElement("div");
    line.className = "exam-date-line";
    line.append(
      buildPickerShell("day"),
      buildPickerShell("month"),
      buildPickerShell("year", { yearWindow })
    );
    root.append(line);

    const pickers = [...line.querySelectorAll("[data-exam-picker]")];
    const todayParts = getTodayParts();
    const currentBuddhistYear = Number(todayParts.year);

    const closePickers = (exceptPicker) => {
      pickers.forEach((picker) => {
        if (picker === exceptPicker) return;
        const trigger = picker.querySelector(".exam-picker-trigger");
        const popover = picker.querySelector("[data-picker-popover]");
        trigger?.setAttribute("aria-expanded", "false");
        if (popover) popover.hidden = true;
      });
    };

    const getValues = () => {
      const read = (type) => pickers.find((picker) => picker.dataset.examPicker === type)?.dataset.value || "";
      return {
        day: read("day"),
        month: read("month"),
        year: read("year"),
      };
    };

    const applyActivityHighlights = () => {
      const values = getValues();
      pickers.forEach((picker) => {
        const pickerType = picker.dataset.examPicker;
        const trigger = picker.querySelector(".exam-picker-trigger");
        const optionsHost = picker.querySelector("[data-picker-options]");
        if (!optionsHost) return;

        optionsHost.querySelectorAll(".exam-picker-option").forEach((option) => {
          const active = optionHasExam(pickerType, option.dataset.value, values, examDateKeys);
          const isToday = isTodayPart(pickerType, option.dataset.value, values, todayParts);
          option.classList.toggle("has-exam", active);
          option.classList.toggle("no-exam", !active);
          option.classList.toggle("is-current", isToday);
          if (isToday) option.setAttribute("aria-current", "date");
          else option.removeAttribute("aria-current");
        });

        if (!trigger) return;
        const selected = picker.dataset.value;
        trigger.classList.toggle(
          "is-today-part",
          Boolean(selected && isTodayPart(pickerType, selected, values, todayParts))
        );
        if (!selected) {
          trigger.classList.remove("has-exam-date", "no-exam-date", "is-today-part");
          return;
        }
        const triggerActive = optionHasExam(pickerType, selected, values, examDateKeys);
        trigger.classList.toggle("has-exam-date", triggerActive);
        trigger.classList.toggle("no-exam-date", !triggerActive);
      });
    };

    const clearPickerValue = (picker) => {
      const trigger = picker.querySelector(".exam-picker-trigger");
      const valueDisplay = picker.querySelector("[data-picker-value]");
      const popover = picker.querySelector("[data-picker-popover]");
      const optionsHost = picker.querySelector("[data-picker-options]");
      delete picker.dataset.value;
      if (valueDisplay) valueDisplay.textContent = "";
      trigger?.classList.remove("has-value", "has-exam-date", "no-exam-date", "is-today-part");
      trigger?.setAttribute("aria-expanded", "false");
      if (popover) popover.hidden = true;
      optionsHost?.querySelectorAll(".exam-picker-option").forEach((item) => {
        item.classList.remove("is-selected");
      });
    };

    const selectPickerValue = (picker, value, { silent = false } = {}) => {
      const trigger = picker.querySelector(".exam-picker-trigger");
      const valueDisplay = picker.querySelector("[data-picker-value]");
      const popover = picker.querySelector("[data-picker-popover]");
      const optionsHost = picker.querySelector("[data-picker-options]");
      if (!trigger || !valueDisplay || !popover || !optionsHost) return;

      picker.dataset.value = String(value);
      const pickerType = picker.dataset.examPicker;
      valueDisplay.textContent =
        pickerType === "month" ? THAI_MONTH_NAMES[Number(value) - 1] : toThaiNumber(value);
      trigger.classList.add("has-value");
      trigger.setAttribute("aria-expanded", "false");
      popover.hidden = true;
      optionsHost.querySelectorAll(".exam-picker-option").forEach((item) => {
        item.classList.toggle("is-selected", item.dataset.value === String(value));
      });
      if (!silent) onChange(getValues());
      applyActivityHighlights();
    };

    const getKey = () => {
      const { day, month, year } = getValues();
      if (!day || !month || !year) return "";
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    };

    const getMatchPrefix = () => {
      const { day, month, year } = getValues();
      if (day && month && year) {
        return {
          mode: "exact",
          value: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        };
      }
      if (month && year) {
        return { mode: "prefix", value: `${year}-${String(month).padStart(2, "0")}-` };
      }
      if (year) return { mode: "prefix", value: `${year}-` };
      return { mode: "all", value: "" };
    };

    const setValues = ({ day = "", month = "", year = "" } = {}, { silent = false } = {}) => {
      const map = { day, month, year };
      pickers.forEach((picker) => {
        const type = picker.dataset.examPicker;
        const next = map[type];
        if (next) selectPickerValue(picker, next, { silent: true });
        else clearPickerValue(picker);
      });
      if (!silent) onChange(getValues());
      applyActivityHighlights();
    };

    const clear = ({ silent = false } = {}) => {
      pickers.forEach(clearPickerValue);
      if (!silent) onChange(getValues());
      applyActivityHighlights();
    };

    const hasValue = () => Boolean(getValues().day || getValues().month || getValues().year);

    pickers.forEach((picker) => {
      const pickerType = picker.dataset.examPicker;
      const trigger = picker.querySelector(".exam-picker-trigger");
      const popover = picker.querySelector("[data-picker-popover]");
      const optionsHost = picker.querySelector("[data-picker-options]");
      if (!trigger || !popover || !optionsHost) return;

      let optionValues;
      if (pickerType === "month") {
        optionValues = Array.from({ length: 12 }, (_, index) => index + 1);
      } else if (pickerType === "year") {
        const min = yearMin ?? currentBuddhistYear;
        const max = yearMax ?? currentBuddhistYear + yearWindow - 1;
        optionValues = [];
        for (let value = min; value <= max; value += 1) optionValues.push(value);
      } else {
        const min = Number(picker.dataset.min || 1);
        const max = Number(picker.dataset.max || 31);
        optionValues = [];
        for (let value = min; value <= max; value += 1) optionValues.push(value);
      }

      optionValues.forEach((value) => {
        const option = document.createElement("button");
        option.className = "exam-picker-option";
        option.type = "button";
        option.dataset.value = String(value);
        option.textContent =
          pickerType === "month" ? THAI_MONTH_NAMES[value - 1] : toThaiNumber(value);
        option.addEventListener("click", (event) => {
          event.stopPropagation();
          selectPickerValue(picker, value);
        });
        optionsHost.append(option);
      });

      trigger.addEventListener("click", (event) => {
        event.stopPropagation();
        const willOpen = popover.hidden;
        closePickers(picker);
        popover.hidden = !willOpen;
        trigger.setAttribute("aria-expanded", String(willOpen));
        if (willOpen) {
          applyActivityHighlights();
          optionsHost.querySelector(".exam-picker-option.is-current, .exam-picker-option.has-exam, .exam-picker-option")?.focus();
        }
      });

      picker.addEventListener("click", (event) => {
        event.stopPropagation();
      });
    });

    const onDocumentClick = (event) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest("[data-exam-picker]")) return;
      closePickers();
    };
    const onDocumentKeydown = (event) => {
      if (event.key === "Escape") closePickers();
    };
    document.addEventListener("click", onDocumentClick);
    document.addEventListener("keydown", onDocumentKeydown);

    if (options.initialValues) {
      setValues(options.initialValues, { silent: true });
    } else {
      applyActivityHighlights();
    }

    return {
      getValues,
      getKey,
      getMatchPrefix,
      setValues,
      clear,
      hasValue,
      updateExamActivity(nextKeys) {
        examDateKeys = normalizeExamDateKeys(nextKeys);
        applyActivityHighlights();
      },
      destroy() {
        document.removeEventListener("click", onDocumentClick);
        document.removeEventListener("keydown", onDocumentKeydown);
        root.replaceChildren();
      },
    };
  }

  global.PaligoExamDatePicker = {
    mount,
    getTodayParts,
    isTodayPart,
    THAI_MONTH_NAMES,
  };
})(typeof window !== "undefined" ? window : globalThis);
