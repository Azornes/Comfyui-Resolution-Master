import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from core import dimension_cache


class FakeRoutes:
    def __init__(self):
        self.get_handlers = {}

    def get(self, path):
        def register(handler):
            self.get_handlers[path] = handler
            return handler

        return register


class FakeWeb:
    @staticmethod
    def json_response(payload, status=200):
        return SimpleNamespace(payload=payload, status=status)


class DimensionCacheTests(unittest.TestCase):
    def setUp(self):
        dimension_cache._image_dimensions_cache.clear()
        dimension_cache._routes_registered = False

    def tearDown(self):
        dimension_cache._image_dimensions_cache.clear()
        dimension_cache._routes_registered = False

    def test_store_normalizes_node_id_dimensions_and_timestamp(self):
        with patch.object(dimension_cache.time, "time", return_value=123.5):
            dimension_cache.store_detected_dimensions(42, "1024", 768.9)

        self.assertEqual(
            dimension_cache.get_detected_dimensions("42"),
            {"width": 1024, "height": 768, "timestamp": 123.5},
        )

    def test_missing_node_id_is_not_cached(self):
        dimension_cache.store_detected_dimensions(None, 1024, 768)

        self.assertEqual(dimension_cache._image_dimensions_cache, {})

    def test_dimension_route_reports_miss_and_hit(self):
        routes = FakeRoutes()
        prompt_server = SimpleNamespace(instance=SimpleNamespace(routes=routes))
        with (
            patch.object(dimension_cache, "PromptServer", prompt_server),
            patch.object(dimension_cache, "web", FakeWeb),
        ):
            dimension_cache._routes_registered = False
            dimension_cache.register_dimension_routes()
            handler = routes.get_handlers["/resolutionmaster/dimensions/{node_id}"]
            missing_request = SimpleNamespace(match_info={"node_id": "node-1"})
            missing = asyncio.run(handler(missing_request))
            self.assertEqual(missing.payload, {"found": False})

            with patch.object(dimension_cache.time, "time", return_value=200.0):
                dimension_cache.store_detected_dimensions("node-1", 640, 480)
            found = asyncio.run(handler(missing_request))

            self.assertEqual(
                found.payload,
                {"found": True, "width": 640, "height": 480, "timestamp": 200.0},
            )
if __name__ == "__main__":
    unittest.main()
