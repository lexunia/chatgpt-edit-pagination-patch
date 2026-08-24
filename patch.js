(function () {
  "use strict";

  const EXPERIMENT_IDS = new Set(["3879630193", "3879348497", "1973873291"]);
  const EDIT_PARAMETER_NAMES = new Set([
    "hide_pagination",
    "edit_buttons_hidden",
    "edit_actions_treatment",
    "edit_warning",
    "variant_modal",
  ]);
  const PAGINATED_MESSAGES_LAYER_ID = "2605344799";
  const TEXT_NEEDLE = /hide_pagination|edit_actions_treatment|2605344799/;
  const INTERESTING_URL = /statsig|initialize|bootstrap/i;
  const INTERESTING_CONTENT_TYPE = /json|javascript|text|html/i;
  const MAX_JSON_STRING_DEPTH = 2;
  let originalParse = JSON.parse;

  const hasEditPaginationTextShape = (text) =>
    text.includes("hide_pagination") &&
    text.includes("edit_buttons_hidden") &&
    text.includes("edit_actions_treatment") &&
    text.includes("edit_warning");

  const patchTextFallback = (text) => {
    if (typeof text !== "string" || !TEXT_NEEDLE.test(text)) return text;
    if (!hasEditPaginationTextShape(text)) return text;

    return text
      .replace(/("hide_pagination"\s*:\s*)true/g, "$1false")
      .replace(/(\\"hide_pagination\\"\s*:\s*)true/g, "$1false")
      .replace(/("edit_buttons_hidden"\s*:\s*)true/g, "$1false")
      .replace(/(\\"edit_buttons_hidden\\"\s*:\s*)true/g, "$1false")
      .replace(/("edit_actions_treatment"\s*:\s*)"(warning|branch_prefill)"/g, '$1"default"')
      .replace(/(\\"edit_actions_treatment\\"\s*:\s*)\\"(warning|branch_prefill)\\"/g, '$1\\"default\\"')
      .replace(/("edit_warning"\s*:\s*)"warning"/g, '$1"none"')
      .replace(/(\\"edit_warning\\"\s*:\s*)\\"warning\\"/g, '$1\\"none\\"')
      .replace(/("variant_modal"\s*:\s*)true/g, "$1false")
      .replace(/(\\"variant_modal\\"\s*:\s*)true/g, "$1false")
      .replace(/("group_name"\s*:\s*)"(Warning|Branch Prefill)"/g, '$1"Control"')
      .replace(/(\\"group_name\\"\s*:\s*)\\"(Warning|Branch Prefill)\\"/g, '$1\\"Control\\"')
      .replace(
        /("is_user_in_experiment"\s*:\s*)true(?=,\s*"allocated_experiment_name"\s*:\s*"(3879630193|3879348497|1973873291)")/g,
        "$1false",
      )
      .replace(
        /(\\"is_user_in_experiment\\"\s*:\s*)true(?=,\s*\\"allocated_experiment_name\\"\s*:\s*\\"(3879630193|3879348497|1973873291)\\")/g,
        "$1false",
      );
  };

  const hasEditPaginationShape = (value) =>
    value &&
    typeof value === "object" &&
    "hide_pagination" in value &&
    "edit_buttons_hidden" in value &&
    "edit_actions_treatment" in value &&
    "edit_warning" in value &&
    typeof value.hide_pagination === "boolean" &&
    typeof value.edit_buttons_hidden === "boolean" &&
    typeof value.edit_actions_treatment === "string" &&
    typeof value.edit_warning === "string" &&
    (!("variant_modal" in value) || typeof value.variant_modal === "boolean");

  const hasCoreEditPaginationShape = (value) =>
    value &&
    typeof value === "object" &&
    "hide_pagination" in value &&
    "edit_actions_treatment" in value;

  const normalizeEditPaginationValue = (value) => {
    value.hide_pagination = false;
    value.edit_buttons_hidden = false;
    value.edit_actions_treatment = "default";
    value.edit_warning = "none";
    if ("variant_modal" in value) value.variant_modal = false;
  };

  const isDefaultEditPaginationValue = (value) =>
    value.hide_pagination === false &&
    value.edit_buttons_hidden === false &&
    value.edit_actions_treatment === "default" &&
    value.edit_warning === "none" &&
    (!("variant_modal" in value) || value.variant_modal === false);

  const shouldPatchResponse = (url, contentType) =>
    INTERESTING_URL.test(url) &&
    INTERESTING_CONTENT_TYPE.test(contentType) &&
    !/text\/event-stream/i.test(contentType);

  const patchExperimentConfig = (cfg) => {
    if (!cfg || typeof cfg !== "object") return false;

    const value = cfg.value;
    const isKnownExperiment = EXPERIMENT_IDS.has(String(cfg.allocated_experiment_name));
    const hit =
      (hasEditPaginationShape(value) && !isDefaultEditPaginationValue(value)) ||
      (isKnownExperiment && hasCoreEditPaginationShape(value));

    if (!hit) return false;

    normalizeEditPaginationValue(value);
    cfg.group_name = "Control";
    cfg.is_user_in_experiment = false;
    cfg.explicit_parameters = Array.isArray(cfg.explicit_parameters)
      ? cfg.explicit_parameters.filter((name) => !EDIT_PARAMETER_NAMES.has(name))
      : [];

    return true;
  };

  const patchPaginatedMessagesConfig = (cfg) => {
    if (
      !cfg ||
      typeof cfg !== "object" ||
      String(cfg.name) !== PAGINATED_MESSAGES_LAYER_ID ||
      !cfg.value ||
      typeof cfg.value !== "object" ||
      typeof cfg.value.num_turns !== "number" ||
      cfg.value.num_turns === 0
    ) {
      return false;
    }

    cfg.value.num_turns = 0;
    if (Array.isArray(cfg.explicit_parameters)) {
      cfg.explicit_parameters = cfg.explicit_parameters.filter((name) => name !== "num_turns");
    }

    return true;
  };

  const patchPossiblyJsonText = (text, jsonStringDepth = 0) => {
    if (typeof text !== "string" || !TEXT_NEEDLE.test(text)) return text;

    if (jsonStringDepth <= MAX_JSON_STRING_DEPTH) {
      try {
        const parsed = originalParse.call(JSON, text);
        if (parsed && typeof parsed === "object") return JSON.stringify(patchObject(parsed, jsonStringDepth));
      } catch {
        // Not a standalone JSON value. Fall back to constrained text replacement.
      }
    }

    return patchTextFallback(text);
  };

  const patchObject = (root, jsonStringDepth = 0) => {
    const seen = new WeakSet();

    const walk = (obj) => {
      if (!obj || typeof obj !== "object" || seen.has(obj)) return;
      seen.add(obj);

      if (obj.layer_configs && typeof obj.layer_configs === "object") {
        patchPaginatedMessagesConfig(obj.layer_configs[PAGINATED_MESSAGES_LAYER_ID]);
        for (const cfg of Object.values(obj.layer_configs)) patchExperimentConfig(cfg);
      }

      patchExperimentConfig(obj);

      if (hasEditPaginationShape(obj)) normalizeEditPaginationValue(obj);

      for (const key of Object.keys(obj)) {
        const value = obj[key];
        if (typeof value === "string") {
          obj[key] = patchPossiblyJsonText(value, jsonStringDepth + 1);
        } else {
          walk(value);
        }
      }
    };

    walk(root);
    return root;
  };

  JSON.parse = function patchedParse(text, reviver) {
    const parsed = originalParse.call(this, text, reviver);
    return typeof text === "string" && TEXT_NEEDLE.test(text) ? patchObject(parsed, 0) : parsed;
  };

  const originalResponseJson = Response.prototype.json;
  Response.prototype.json = function patchedResponseJson(...args) {
    const parsedPromise = originalResponseJson.apply(this, args);
    const url = String(this.url ?? "");
    const contentType = this.headers.get("content-type") ?? "";

    if (!shouldPatchResponse(url, contentType)) return parsedPromise;

    return parsedPromise.then((parsed) => {
      if (typeof parsed === "string") return patchPossiblyJsonText(parsed);
      return patchObject(parsed, 0);
    });
  };

  if (globalThis.__CHATGPT_EDIT_PAGINATION_PATCH_TEST__ === true) {
    globalThis.__chatgptEditPaginationPatch = {
      hasEditPaginationShape,
      isDefaultEditPaginationValue,
      normalizeEditPaginationValue,
      patchObject,
      patchPaginatedMessagesConfig,
      patchPossiblyJsonText,
      shouldPatchResponse,
    };
  }
})();
