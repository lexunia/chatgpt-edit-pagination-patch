# ChatGPT Edit Pagination Patch

Small unpacked Chrome extension for restoring the old ChatGPT edited-message branch pagination UI when an experiment hides it.

It was made for the experiment state where edited message variants stop showing the usual `1/2`, `2/2` branch controls and instead use the newer edit warning/treatment behavior.

## What It Changes

The extension looks for ChatGPT bootstrap/config objects with this edit-pagination value shape:

```js
{
  hide_pagination,
  edit_buttons_hidden,
  edit_actions_treatment,
  edit_warning,
}
```

When that shape is found, the value is normalized to the default profile behavior:

```js
{
  hide_pagination: false,
  edit_buttons_hidden: false,
  edit_actions_treatment: "default",
  edit_warning: "none",
}
```

For known affected experiment configs, metadata is also normalized:

```js
group_name: "Control"
is_user_in_experiment: false
```

Edit-pagination entries are removed from `explicit_parameters`; unrelated entries are preserved.

Known experiment ids are used only as secondary markers:

```txt
3879630193
3879348497
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

## Install

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select the `chatgpt-edit-pagination-patch` folder.
5. Reload ChatGPT with `Ctrl+Shift+R`.

## Known Limits

This extension depends on internal ChatGPT frontend config fields. It can stop working if ChatGPT changes the bootstrap/statsig payload structure or renames the edit-pagination fields.

This is a local temporary patch, not a permanent API or official ChatGPT setting.
