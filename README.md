# ChatGPT Edit Pagination Patch

Small unpacked Chrome extension for restoring ChatGPT edited-message version controls when an experiment or conversation-loading rollout removes normal branch navigation.

It was made for ChatGPT states where edited message variants stop behaving like normal selectable versions:

- older variants hid the usual `1/2`, `2/2` branch controls;
- a later variant shows the versions, but opening an older version leads to a "continue in a new chat" modal instead of letting you work with that version in place;
- the current paginated-messages rollout changes the initial conversation response from a full graph to a `messages` payload without the full conversation graph and handles older versions separately.

## Install

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select the `chatgpt-edit-pagination-patch` folder.
5. Reload ChatGPT with `Ctrl+Shift+R`.

## What It Changes

### Current conversation-loading rollout

The current rollout is controlled by this bootstrap layer:

```js
layer_configs["2605344799"].value.num_turns
```

An observed affected value is:

```js
{
  "2605344799": {
    value: {
      num_turns: 10,
    },
    parameter_rule_ids: {
      num_turns: "shippedValues:chatgpt-web-paginated-messages-rollout",
    },
  },
}
```

With a positive `num_turns` value, the current frontend selects the new endpoint:

```txt
/backend-api/conversations/<conversation_id>?include_has_versions=true&num_turns=10
```

This endpoint returns a `messages` payload and handles message versions separately.

Message versions can be requested separately through:

```txt
/backend-api/conversations/<conversation_id>/versions?message_id=<message_id>
```

The previous loading path uses:

```txt
/backend-api/conversation/<conversation_id>
```

The old endpoint returns the full conversation `mapping`, including `parent`, `children`, and `current_node` relationships used by the original branch controls.

The extension changes `num_turns` to `0` before ChatGPT reads the config. In the current frontend, `0` disables the paginated-message loader, so ChatGPT itself selects the old endpoint and its matching branch-navigation path.

If `num_turns` appears in `explicit_parameters`, only that entry is removed. Other parameters and rollout metadata are preserved.

### Previous edit-pagination experiments

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

For previous experiment configs, the primary match is the edit-pagination field shape, not a single user id or account-specific id. The current conversation-loading rollout is matched separately by the exact `2605344799` layer id and its numeric `num_turns` value.

## How It Works

The content script runs at `document_start` on:

```txt
https://chatgpt.com/*
```

It installs two early hooks in the page context:

- `JSON.parse`
- `Response.prototype.json`

`JSON.parse` only walks parsed objects when the original JSON text contains edit-pagination markers or the exact `2605344799` conversation-loading layer id.

`Response.prototype.json` only patches parsed values from config-like responses whose URL contains one of:

```txt
statsig
initialize
bootstrap
```

For other backend responses, it returns the original parsed result without patching it.

For the current rollout, the extension changes the matching bootstrap value before the ChatGPT frontend reads it. It does not install a `fetch` hook or rewrite the endpoint URL. ChatGPT then selects `/backend-api/conversation/<conversation_id>` through its own legacy loading path.

## Known Limits

This extension depends on internal ChatGPT frontend config fields. It can stop working if ChatGPT changes the bootstrap/statsig payload structure or renames the edit-pagination fields.

The current rollout fix depends on the frontend continuing to interpret the `2605344799` layer and its `num_turns` value as it does now. It also depends on the old `/backend-api/conversation/<conversation_id>` endpoint and the legacy loading path remaining available. If the server stops returning the full graph through any accessible endpoint, the extension cannot reconstruct branches that the browser never receives.

Pagination for edited versions of the first user message is currently not restored.

This is a local temporary patch, not a permanent API or official ChatGPT setting.
