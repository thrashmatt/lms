# Copyright (c) 2021, FOSS United and Contributors
# See license.txt

import frappe

from lms.lms.api import get_sidebar_settings, update_branding
from lms.lms.test_helpers import BaseTestUtils


class TestLMSSettings(BaseTestUtils):
	def setUp(self):
		super().setUp()
		self.original_user = frappe.session.user
		self.website_settings = frappe.get_single("Website Settings")
		self.original_branding = {
			field: self.website_settings.get(field)
			for field in ("app_name", "banner_image", "favicon", "app_logo")
		}

	def tearDown(self):
		frappe.set_user("Administrator")
		frappe.get_single("Website Settings").update(self.original_branding).save()
		frappe.set_user(self.original_user)
		super().tearDown()

	def test_sidebar_options_default_to_enabled(self):
		for field in ("programs", "quizzes", "assignments"):
			self.assertEqual(frappe.get_meta("LMS Settings").get_field(field).default, "1")

		self.assertEqual(
			{field: get_sidebar_settings()[field] for field in ("programs", "quizzes", "assignments")},
			{"programs": 1, "quizzes": 1, "assignments": 1},
		)

	def test_branding_update_persists_and_keeps_logo_in_sync(self):
		frappe.set_user("Administrator")
		updated = update_branding(
			{"app_name": "Focused Test Brand", "banner_image": "/files/test-logo.svg", "favicon": None}
		)

		self.assertEqual(updated.app_name, "Focused Test Brand")
		persisted = frappe.get_single("Website Settings")
		self.assertEqual(persisted.app_name, "Focused Test Brand")
		self.assertEqual(persisted.app_logo, "/files/test-logo.svg")

	def test_branding_update_requires_website_settings_write_permission(self):
		frappe.set_user("Guest")
		with self.assertRaises(frappe.PermissionError):
			update_branding({"app_name": "Should Not Persist"})
