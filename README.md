# Spare the Mental Math

A small Foundry VTT (v12) module that lets you do arithmetic directly in numeric
fields on actor and item sheets — HP, temp HP, currency/coins, ability scores,
item quantities, and so on.

## Usage

Click into any numeric field and type:

| You type   | Meaning                          | Example (field shows 10) |
|------------|----------------------------------|--------------------------|
| `+5`       | add to the current value         | → 15                     |
| `-3`       | subtract from the current value  | → 7                      |
| `*2`       | multiply the current value       | → 20                     |
| `/4`       | divide the current value         | → 2.5                    |
| `12+7`     | evaluate as an absolute result   | → 19                     |
| `(5+3)*2`  | full expressions work too        | → 16                     |
| `42`       | plain number, set as normal      | → 42                     |

A **leading `+ - * /`** adjusts the value already in the box. Anything else is
evaluated as a standalone expression. Press Enter or click away to apply.

## Install (manifest URL — recommended)

In Foundry: **Add-on Modules → Install Module**, and paste this into the
**Manifest URL** box (replace `YOUR_USERNAME`):

```
https://github.com/YOUR_USERNAME/math-input-fields/releases/latest/download/module.json
```

This always installs the latest release and lets Foundry notify you of updates.

## Install (manual)

Alternatively, copy the `math-input-fields` folder into your Foundry
`Data/modules/` directory:

```
<FoundryUserData>/Data/modules/math-input-fields/
```

Then in Foundry: **Game Settings → Manage Modules → enable "Spare the Mental Math"**.

## Notes

- Targeted fields are converted from `<input type="number">` to `type="text"`
  so operators can be typed. The browser's up/down spinner arrows are no longer
  shown on those fields as a result.
- Only arithmetic characters (`0-9 + - * / ( ) .`) are ever evaluated — there is
  no `eval` of arbitrary code.
- Built and verified for dnd5e on Foundry v12. It uses the generic
  `renderActorSheet` / `renderItemSheet` hooks, so it should also work on most
  other systems, though only dnd5e was the design target.
