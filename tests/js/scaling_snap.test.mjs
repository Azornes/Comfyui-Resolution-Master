import assert from "node:assert/strict";
import test from "node:test";
import { calculateScaledDimensions } from "../../js/scaling/scaling_math.js";
import { calculationMethods } from "../../js/calculations/resolution_master_calculation_methods.js";
import { autoDetectMethods } from "../../js/auto_detect/auto_detect_methods.js";

test("snap preview rounds independent dimensions or preserves exact ratio with snap", () => {
    assert.deepEqual(calculateScaledDimensions(1000, 600, 1.23, false, true, 64), { width: 1216, height: 768 });
    assert.deepEqual(calculateScaledDimensions(1920, 1080, 0.5, true, true, 64), { width: 1024, height: 576 });
    for (const [width, height, scale, snap] of [[1080, 1920, 1.3, 32], [1000, 600, 0, 64], [1359, 1472, 1.2, 16]]) {
        const result = calculateScaledDimensions(width, height, scale, true, true, snap);
        assert.equal(result.width % snap, 0);
        assert.equal(result.height % snap, 0);
        assert.equal(result.width * height, result.height * width);
    }
    assert.deepEqual(calculateScaledDimensions(1000, 600, 1.23, false), { width: 1230, height: 738 });
});

test("snap preference reaches previews, calculation payloads and saved backend widgets", () => {
    const context = {
        node: { properties: { preserveScalingRatio: true, preserveScalingSnap: true, snapValue: 64 } },
        widthWidget: { value: 1920 }, heightWidget: { value: 1080 },
        backendFallbackWidgets: { preserveScalingSnap: { value: false } },
        getCategoryPresetsJSON() { return "{}"; },
        setBackendFallbackWidgetValue: autoDetectMethods.setBackendFallbackWidgetValue
    };
    assert.deepEqual(calculationMethods.calculateLocalScaledDimensions.call(context, 0.5), { width: 1024, height: 576 });
    assert.equal(calculationMethods.buildCalculationPayload.call(context, "auto_resize").preserve_scaling_snap, true);
    autoDetectMethods.syncBackendFallbackWidgets.call(context);
    assert.equal(context.backendFallbackWidgets.preserveScalingSnap.value, true);
});
