"""
Tests for OAuth parameter validation
"""
import re
from django.test import TestCase


class OAuthParameterValidationTests(TestCase):
    """Test OAuth parameter regex validation patterns"""
    
    def test_state_validation_accepts_valid_formats(self):
        """Test that state validation accepts alphanumeric with dots, hyphens, underscores"""
        state_pattern = re.compile(r'^[A-Za-z0-9._-]+$')
        
        valid_states = [
            'abc123',
            'state-with-hyphens',
            'state_with_underscores',
            'state.with.dots',
            'MiXeD-CaSe_123.abc',
            'a1b2c3d4e5f6g7h8',
        ]
        
        for state in valid_states:
            with self.subTest(state=state):
                self.assertTrue(
                    state_pattern.match(state),
                    f"Valid state '{state}' should match the pattern"
                )
    
    def test_state_validation_rejects_invalid_formats(self):
        """Test that state validation rejects invalid characters"""
        state_pattern = re.compile(r'^[A-Za-z0-9._-]+$')
        
        invalid_states = [
            'state/with/slashes',  # Slashes not allowed in state
            'state with spaces',
            'state@with@at',
            'state#with#hash',
            'state=with=equals',
            'state+with+plus',
            'state:with:colons',
        ]
        
        for state in invalid_states:
            with self.subTest(state=state):
                self.assertFalse(
                    state_pattern.match(state),
                    f"Invalid state '{state}' should not match the pattern"
                )
    
    def test_code_validation_accepts_google_oauth_format(self):
        """Test that code validation accepts Google OAuth authorization codes"""
        # Updated pattern that allows URL-safe characters including forward slashes
        code_pattern = re.compile(r'^[A-Za-z0-9._\-/~%+:=]+$')
        
        valid_codes = [
            '4/0ATX87INJQU6UwXntU',  # Typical Google OAuth code with slash
            '4/0AX4XfWjklmNOPQRSTUVWXYZ',
            'simple-code',
            'code_with_underscores',
            'code.with.dots',
            'code~with~tildes',
            'code%20encoded',
            'code+with+plus',
            'code:with:colons',
            'code=with=equals',
            'MiXeD-CaSe_123/abc',
        ]
        
        for code in valid_codes:
            with self.subTest(code=code):
                self.assertTrue(
                    code_pattern.match(code),
                    f"Valid code '{code}' should match the pattern"
                )
    
    def test_code_validation_rejects_dangerous_characters(self):
        """Test that code validation still rejects potentially dangerous characters"""
        code_pattern = re.compile(r'^[A-Za-z0-9._\-/~%+:=]+$')
        
        invalid_codes = [
            'code with spaces',
            'code"with"quotes',
            "code'with'apostrophes",
            'code<with>brackets',
            'code{with}braces',
            'code[with]square',
            'code;with;semicolons',
            'code|with|pipes',
            'code&with&ampersands',
            'code$with$dollars',
            'code!with!exclamations',
            'code*with*asterisks',
            'code(with)parens',
        ]
        
        for code in invalid_codes:
            with self.subTest(code=code):
                self.assertFalse(
                    code_pattern.match(code),
                    f"Invalid code '{code}' should not match the pattern"
                )
    
    def test_code_validation_specific_google_examples(self):
        """Test specific real-world Google OAuth code examples"""
        code_pattern = re.compile(r'^[A-Za-z0-9._\-/~%+:=]+$')
        
        # Real-world Google OAuth code patterns
        google_codes = [
            '4/0ATX87INJQU6UwXntUHVzWYZ1234567890',
            '4/0AX4XfWh4jZ9qUwXntUHVzWYZ',
            '4/0AbCdEfGhIjKlMnOpQrStUvWxYz',
        ]
        
        for code in google_codes:
            with self.subTest(code=code):
                self.assertTrue(
                    code_pattern.match(code),
                    f"Real Google OAuth code '{code}' should match the pattern"
                )
