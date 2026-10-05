import assert from "node:assert/strict";
import test from "node:test";
import { initialCredentialValues } from "../../../lib/admin/model-plugins";
import {
  definition as deepseek,
  DEFAULT_BASE_URL as deepseekUrl,
} from "../../../plugins/piwork-llm-deepseek/src/provider";
import {
  definition as tongyi,
  DEFAULT_BASE_URL as tongyiUrl,
} from "../../../plugins/piwork-llm-tongyi/src/provider";
import {
  definition as zhipu,
  DEFAULT_BASE_URL as zhipuUrl,
} from "../../../plugins/piwork-llm-zhipuai/src/provider";

test("plugin public endpoint metadata matches the endpoint used with default credentials", () => {
  assert.equal(deepseek.defaultBaseUrl, deepseekUrl);
  assert.equal(tongyi.defaultBaseUrl, tongyiUrl);
  assert.equal(zhipu.defaultBaseUrl, zhipuUrl);
});

test("new forms receive public field defaults without any secret or guessed endpoint", () => {
  const values = initialCredentialValues({
    credentialFields: [
      ...zhipu.credentialFields,
      {
        default: zhipuUrl,
        label: { en: "Base URL" },
        required: false,
        type: "text-input",
        variable: "base_url",
      },
      {
        default: "glm-5-turbo",
        label: { en: "Validation model" },
        required: false,
        type: "text-input",
        variable: "validate_model",
      },
      {
        default: "never-copy",
        label: { en: "Secret" },
        required: true,
        type: "secret-input",
        variable: "secret",
      },
    ],
    credentialsConfigured: false,
  });
  assert.equal(values.base_url, zhipu.defaultBaseUrl);
  assert.equal(values.validate_model, "glm-5-turbo");
  assert.equal(values.api_key, undefined);
  assert.equal(values.secret, undefined);
  assert.deepEqual(initialCredentialValues(null), {});
});

test("configured forms leave credentials empty so rotating keys cannot reset custom endpoints", () => {
  assert.deepEqual(
    initialCredentialValues({
      credentialFields: zhipu.credentialFields,
      credentialsConfigured: true,
    }),
    {}
  );
});
