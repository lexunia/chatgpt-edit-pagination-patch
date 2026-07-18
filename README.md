# ChatGPT Edit Pagination Patch

Small unpacked Chrome extension for restoring ChatGPT edited-message version controls when an experiment hides them or forces the newer branch modal.

It was made for experiment states where edited message variants stop behaving like normal selectable versions:

- older variants hid the usual `1/2`, `2/2` branch controls;
- the newer variant shows the versions, but opening an older version leads to a "continue in a new chat" modal instead of letting you work with that version in place.

## Install

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select the `chatgpt-edit-pagination-patch` folder.
5. Reload ChatGPT with `Ctrl+Shift+R`.

## What It Changes

The extension looks for ChatGPT bootstrap/config objects with this edit-pagination value shape:

```js
{
  variant_modal,
  hide_pagination,
  edit_actions_treatment,
  edit_buttons_hidden,
  edit_warning,
}
```

Observed fields:

- `variant_modal`: newer experiment flag. When `true`, ChatGPT opens older edited-message versions in a branch modal with a "continue in a new chat" action.
- `hide_pagination`: older experiment flag. When `true`, ChatGPT hides the usual edited-message version pagination controls.
- `edit_actions_treatment`: older experiment treatment string. Observed affected values were `"warning"` and `"branch_prefill"`.
- `edit_buttons_hidden`: edit-control visibility flag. The default value is `false`.
- `edit_warning`: edit-warning mode. The default value is `"none"`.

When that shape is found, the value is normalized to the default profile behavior:

```js
{
  variant_modal: false,
  hide_pagination: false,
  edit_actions_treatment: "default",
  edit_buttons_hidden: false,
  edit_warning: "none",
}
```

For known affected experiment configs, metadata is also normalized:

```js
group_name: "Control"
is_user_in_experiment: false
```

Edit-pagination entries are removed from `explicit_parameters`; unrelated entries are preserved.

Observed affected experiments:

| Experiment id | Group | Explicit parameters | Observed behavior |
| --- | --- | --- | --- |
| `1973873291` | `Test` | `variant_modal` | Shows edited-message versions, but opens older versions through the branch modal. |
| `3879630193` | `Warning` | `hide_pagination`, `edit_actions_treatment` | Hides edited-message pagination and applies the warning treatment. |
| `3879348497` | `Branch Prefill` | `hide_pagination`, `edit_actions_treatment` | Hides edited-message pagination and applies the branch-prefill treatment. |

Known experiment ids are used only as secondary markers.

The primary match is the edit-pagination field shape, not a single user id or account-specific id.

## What It Does Not Do

The extension does not:

- declare Chrome API permissions such as cookies, storage, tabs, `webRequest`, or scripting; its only site access is the `https://chatgpt.com/*` content-script match;
- send requests;
- collect or upload data;
- read cookies directly;
- patch the page DOM;
- patch `localStorage` or `sessionStorage`;
- modify conversation content;
- modify model context, memory, files, tools, custom instructions, or chat history.

## How It Works

The content script runs at `document_start` on:

```txt
https://chatgpt.com/*
```

It installs two early hooks in the page context:

- `JSON.parse`
- `Response.prototype.json`

`JSON.parse` only walks parsed objects when the original JSON text contains edit-pagination markers.

`Response.prototype.json` only patches parsed values from config-like responses whose URL contains one of:

```txt
statsig
initialize
bootstrap
```

For other backend responses, it returns the original parsed result without patching it.

## Known Limits

This extension depends on internal ChatGPT frontend config fields. It can stop working if ChatGPT changes the bootstrap/statsig payload structure or renames the edit-pagination fields.

This is a local temporary patch, not a permanent API or official ChatGPT setting.
