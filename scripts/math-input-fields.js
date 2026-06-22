/**
 * Spare the Mental Math
 * ---------------------
 * Lets you type arithmetic into numeric inputs on actor/item sheets.
 *
 *   +5     -> current value + 5     (relative)
 *   -3     -> current value - 3     (relative)
 *   *2     -> current value * 2     (relative)
 *   /4     -> current value / 4     (relative)
 *   12+7   -> 19                    (absolute expression)
 *   (5+3)*2-> 16                    (absolute expression)
 *
 * A leading + - * / means "relative to the value already in the box".
 * Anything else is evaluated as a standalone expression.
 *
 * Design note: rather than hooking sheet-render events (which fire under the
 * exact subclass name, e.g. renderActorSheet5eCharacter2, and so are easy to
 * miss across systems/versions), we attach two CAPTURE-phase listeners at the
 * document level. They see every numeric, data-bound input on any sheet —
 * including fields the system already manages itself, like dnd5e's HP — and
 * resolve the expression before the system's or Foundry's own change handler
 * reads the value off the form.
 */

const MODULE_ID = "math-input-fields";

/** Only these characters are allowed in an expression we will evaluate. */
const SAFE_EXPRESSION = /^[\d+\-*/().\s]+$/;

/** A value that begins (after trimming) with one of these is "relative". */
const RELATIVE_PREFIX = /^[+\-*/]/;

/**
 * Safely evaluate a user-entered expression.
 * @param {string} raw   The raw string from the input.
 * @param {number} base  The numeric value the field held before editing.
 * @returns {number|null} The computed number, or null if it isn't a valid
 *                        expression (in which case we leave the input alone).
 */
function evaluateExpression(raw, base) {
  const trimmed = String(raw ?? "").trim();
  if (trimmed === "") return null;

  // An unsigned plain number is not an "expression" we need to touch — let
  // Foundry handle it normally. A LEADING + or - is intentionally NOT bare:
  // it means "adjust the current value" (e.g. -3 spends 3), handled below.
  if (/^\d*\.?\d+$/.test(trimmed)) return null;

  let expr;
  if (RELATIVE_PREFIX.test(trimmed)) {
    const safeBase = Number.isFinite(base) ? base : 0;
    expr = `(${safeBase})${trimmed}`;
  } else {
    expr = trimmed;
  }

  if (!SAFE_EXPRESSION.test(expr)) return null;

  let result;
  try {
    // No identifiers can survive the SAFE_EXPRESSION whitelist, so this is
    // arithmetic only — no access to globals, no side effects.
    result = Function(`"use strict"; return (${expr});`)();
  } catch (err) {
    return null;
  }

  if (typeof result !== "number" || !Number.isFinite(result)) return null;

  // Kill floating-point noise (e.g. 0.1 + 0.2) while preserving decimals.
  return Math.round(result * 1e6) / 1e6;
}

/**
 * Should this element accept arithmetic? We want data-bound numeric inputs
 * that live inside a document sheet (actor, item, etc.).
 * @param {EventTarget} el
 * @returns {el is HTMLInputElement}
 */
function isTargetInput(el) {
  if (!(el instanceof HTMLInputElement)) return false;
  if (!el.name) return false;                         // not bound to sheet data
  if (el.disabled || el.readOnly) return false;
  if (!el.closest(".sheet")) return false;            // only inside document sheets

  const inputMode = el.getAttribute("inputmode") || "";
  return (
    el.type === "number" ||                           // a plain numeric field
    el.dataset.dtype === "Number" ||                  // Foundry-tagged numeric
    el.dataset.mifReady === "1" ||                    // we already prepared it
    inputMode === "numeric" ||                        // system numeric text field
    inputMode === "decimal"                           // (e.g. dnd5e HP)
  );
}

/**
 * Make a field able to accept operators and submit as a Number.
 * @param {HTMLInputElement} input
 */
function ensureEditable(input) {
  if (input.dataset.mifReady === "1") return;
  input.dataset.mifReady = "1";

  // A native <input type="number"> physically rejects characters like "+",
  // so switch it to text. We keep a numeric on-screen keyboard for mobile.
  if (input.type === "number") {
    input.type = "text";
    input.setAttribute("inputmode", "decimal");
    input.autocomplete = "off";
  }

  // Critical: a native number input is coerced to a Number by Foundry's
  // FormDataExtended on submit; a text input is left as a String, which fails
  // data-model validation (e.g. "hp.value must be an integer"). Tagging the
  // field tells Foundry to coerce our result back to a Number.
  if (input.dataset.dtype !== "Number") input.setAttribute("data-dtype", "Number");
}

/**
 * On focus, remember the field's current value so relative operators
 * (+5, -3, ...) have a base to work from, and make the field editable.
 * @param {FocusEvent} event
 */
function onFocusIn(event) {
  const input = event.target;
  if (!isTargetInput(input)) return;
  ensureEditable(input);
  const n = Number(input.value);
  input.dataset.mifBase = Number.isFinite(n) ? String(n) : "0";
}

/**
 * On change, resolve any arithmetic in the field to a concrete number BEFORE
 * the system's / Foundry's own change handler reads it. Runs in the capture
 * phase at the document level, so it precedes every other change listener.
 * @param {Event} event
 */
function onChangeCapture(event) {
  const input = event.target;
  if (!isTargetInput(input)) return;

  let base = Number(input.dataset.mifBase);
  if (!Number.isFinite(base)) base = 0;

  const computed = evaluateExpression(input.value, base);
  if (computed !== null) {
    input.value = String(computed);
    input.dataset.mifBase = String(computed);
  }
}

Hooks.once("ready", () => {
  document.addEventListener("focusin", onFocusIn, true);
  document.addEventListener("change", onChangeCapture, true);
  console.log(`${MODULE_ID} | ready — arithmetic enabled in numeric sheet fields.`);
});
