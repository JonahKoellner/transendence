from django.db import models
from django.contrib.auth.models import User
import pyotp

class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    otp_secret = models.CharField(max_length=16, blank=True, null=True)
    is_2fa_enabled = models.BooleanField(default=False)

    # Generate a new OTP secret and provisioning URI for QR code
    def generate_otp(self):
        if not self.otp_secret:
            self.otp_secret = pyotp.random_base32()  # Generate a new secret
            self.save()
        return pyotp.TOTP(self.otp_secret).provisioning_uri(self.user.email, issuer_name="YourApp")

    # Generate the provisioning URI for QR code
    def get_otp_uri(self):
        return pyotp.TOTP(self.otp_secret).provisioning_uri(self.user.email, issuer_name="YourApp")

    # Verify the OTP code entered by the user
    def verify_otp(self, otp_code):
        totp = pyotp.TOTP(self.otp_secret)
        return totp.verify(otp_code)