# Generated by Django 5.0.6 on 2024-10-20 21:44

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="profile",
            name="nickname",
        ),
    ]
