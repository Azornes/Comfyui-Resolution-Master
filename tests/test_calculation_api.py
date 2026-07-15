import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from core import calculation_api


class FakeRoutes:
    def __init__(self):
        self.post_handlers = {}

    def post(self, path):
        def register(handler):
            self.post_handlers[path] = handler
            return handler

        return register


class FakeWeb:
    @staticmethod
    def json_response(payload, status=200):
        return SimpleNamespace(payload=payload, status=status)


class FakeRequest:
    def __init__(self, payload=None, error=None):
        self.payload = payload
        self.error = error

    async def json(self):
        if self.error is not None:
            raise self.error
        return self.payload


class PayloadNormalizationTests(unittest.TestCase):
    def test_string_booleans_and_numbers_are_normalized(self):
        normalized = calculation_api._normalize_payload(
            {
                "action": "auto_detect",
                "width": "1024",
                "height": "768",
                "auto_fit_on_change": "YES",
                "auto_resize_on_change": "false",
                "auto_snap_on_change": 1,
                "snap_value": "32",
                "target_megapixels": "3.5",
            }
        )

        self.assertEqual(normalized["width"], 1024)
        self.assertEqual(normalized["height"], 768)
        self.assertTrue(normalized["auto_fit_on_change"])
        self.assertFalse(normalized["auto_resize_on_change"])
        self.assertTrue(normalized["auto_snap_on_change"])
        self.assertEqual(normalized["snap_value"], 32)
        self.assertEqual(normalized["target_megapixels"], 3.5)

    def test_missing_and_invalid_values_use_api_defaults(self):
        normalized = calculation_api._normalize_payload({"width": "wide", "height": None})

        self.assertEqual(normalized["action"], "rescale")
        self.assertEqual(normalized["width"], 512)
        self.assertEqual(normalized["height"], 512)
        self.assertEqual(normalized["rescale_mode"], "resolution")
        self.assertEqual(normalized["presets_json"], "{}")


class CalculationRouteTests(unittest.TestCase):
    def setUp(self):
        self.routes = FakeRoutes()
        prompt_server = SimpleNamespace(instance=SimpleNamespace(routes=self.routes))
        self.prompt_server_patch = patch.object(calculation_api, "PromptServer", prompt_server)
        self.web_patch = patch.object(calculation_api, "web", FakeWeb)
        self.prompt_server_patch.start()
        self.web_patch.start()
        calculation_api._routes_registered = False
        calculation_api.register_calculation_routes()
        self.handler = self.routes.post_handlers["/resolutionmaster/calculate"]

    def tearDown(self):
        calculation_api._routes_registered = False
        self.web_patch.stop()
        self.prompt_server_patch.stop()

    def test_route_calculates_a_normalized_request(self):
        response = asyncio.run(
            self.handler(
                FakeRequest(
                    {
                        "action": "auto_snap",
                        "width": "70",
                        "height": "95",
                        "snap_value": "64",
                    }
                )
            )
        )

        self.assertEqual(response.status, 200)
        self.assertTrue(response.payload["ok"])
        self.assertEqual(response.payload["width"], 64)
        self.assertEqual(response.payload["height"], 64)

    def test_route_returns_400_for_non_object_or_unsupported_action(self):
        for payload in (["not", "an", "object"], {"action": "unsupported"}):
            with self.subTest(payload=payload):
                response = asyncio.run(self.handler(FakeRequest(payload)))

                self.assertEqual(response.status, 400)
                self.assertFalse(response.payload["ok"])
                self.assertIn("error", response.payload)

    def test_route_returns_500_for_unexpected_request_failure(self):
        response = asyncio.run(self.handler(FakeRequest(error=RuntimeError("request failed"))))

        self.assertEqual(response.status, 500)
        self.assertEqual(response.payload, {"ok": False, "error": "request failed"})


if __name__ == "__main__":
    unittest.main()
