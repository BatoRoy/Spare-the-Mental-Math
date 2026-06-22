/**
 * Math in Input Fields
 * --------------------
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
 * Native <input type="number"> elements won't physically accept a
 * character like "+" in the middle of a number, so we convert the
 * targeted fields to type="text" and validate/evaluate the expression
 * ourselves before Foundry reads the value off the form.
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
 * Prepare a single input so it accepts and evaluates expressions.
 * @param {HTMLInputElement} input
 */
function prepareInput(input) {
  if (input.dataset.mifReady) return;            // already wired up
  if (!input.name) return;                       // not bound to sheet data
  if (input.disabled || input.readOnly) return;

  input.dataset.mifReady = "1";

  // Remember what kind of field this was, then make it accept text so the
  // user can type operators. We keep numeric hints for mobile keyboards.
  input.dataset.mifWasNumber = "1";
  input.type = "text";
  input.setAttribute("inputmode", "decimal");
  input.autocomplete = "off";

  // Capture the "base" value whenever the user starts editing, so relative
  // operators (+5, -3, ...) know what to operate on.
  input.addEventListener("focus", () => {
    const n = Number(input.value);
    input.dataset.mifBase = Number.isFinite(n) ? String(n) : "0";
  });

  // Run in the CAPTURE phase so we rewrite the value before Foundry's own
  // bubbling change-handler reads it off the form and submits.
  input.addEventListener(
    "change",
    (event) => {
      const base = Number(input.dataset.mifBase ?? "0");
      const computed = evaluateExpression(input.value, base);
      if (computed !== null) {
        input.value = String(computed);
        // Refresh the base in case the field stays focused / re-fires.
        input.dataset.mifBase = String(computed);
      }
    },
    { capture: true }
  );
}

/**
 * Wire up every numeric input inside a rendered sheet.
 * @param {Application} app
 * @param {jQuery|HTMLElement} html
 */
function onRenderSheet(app, html) {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root) return;

  const inputs = root.querySelectorAll('input[type="number"]');
  for (const input of inputs) prepareInput(input);
}

Hooks.on("renderActorSheet", onRenderSheet);
Hooks.on("renderItemSheet", onRenderSheet);

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | initialized — arithmetic enabled in numeric sheet fields.`);
});
