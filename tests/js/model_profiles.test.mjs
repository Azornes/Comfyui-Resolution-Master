import assert from "node:assert/strict";
import test from "node:test";

import {
    SUPPORTED_CALCULATION_STRATEGIES,
    getModelInfoMessage,
    getSerializableModelProfile,
    modelProfiles
} from "../../js/calculations/model_profiles.js";
import { presetCategories } from "../../js/presets/preset_categories.js";


test("every built-in preset category has a complete calculation profile", () => {
    assert.deepEqual(
        Object.keys(modelProfiles).sort(),
        Object.keys(presetCategories).sort()
    );

    for (const category of Object.keys(presetCategories)) {
        const profile = getSerializableModelProfile(category);
        assert.ok(profile, `${category} is missing a calculation profile`);
        assert.ok(
            SUPPORTED_CALCULATION_STRATEGIES.includes(profile.strategy),
            `${category} uses unsupported strategy ${profile.strategy}`
        );
        assert.equal(typeof profile.options, "object");
        assert.ok(
            getModelInfoMessage(category, { width: 1024, height: 1024 }),
            `${category} is missing an info message`
        );
    }
});


test("serializable profiles contain only backend calculation data", () => {
    const profile = getSerializableModelProfile("WAN");
    const roundTripped = JSON.parse(JSON.stringify(profile));

    assert.deepEqual(roundTripped, profile);
    assert.deepEqual(Object.keys(profile).sort(), ["options", "strategy"]);
    assert.equal(profile.options.multiple, 16);
});
