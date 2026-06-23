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
  hide_pagination,
  edit_buttons_hidden,
  edit_actions_treatment,
  edit_warning,
  variant_modal, // optional in older payloads
}
```

When that shape is found, the value is normalized to the default profile behavior:

```js
{
  hide_pagination: false,
  edit_buttons_hidden: false,
  edit_actions_treatment: "default",
  edit_warning: "none",
  variant_modal: false, // only when the field exists
}
```

For known affected experiment configs, metadata is also normalized:

```js
group_name: "Control"
is_user_in_experiment: false
```

Edit-pagination entries are removed from `explicit_parameters`; unrelated entries are preserved. This includes `variant_modal` when present.

Known experiment ids are used only as secondary markers:

```txt
3879630193
3879348497
1973873291
```

Observed affected groups:

```txt
Warning
Branch Prefill
Test
```

The primary match is the edit-pagination field shape, not a single user id or account-specific id.

## What It Does Not Do

The extension does not:

- add extension permissions;
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
- `fetch`

`JSON.parse` only walks parsed objects when the original JSON text contains edit-pagination markers.

`fetch` only inspects config-like responses whose URL contains one of:

```txt
statsig
initialize
bootstrap
```

Other backend responses are returned untouched.

## Known Limits

This extension depends on internal ChatGPT frontend config fields. It can stop working if ChatGPT changes the bootstrap/statsig payload structure or renames the edit-pagination fields.

This is a local temporary patch, not a permanent API or official ChatGPT setting.
