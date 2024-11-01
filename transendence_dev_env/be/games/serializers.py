from rest_framework import serializers
from .models import Game
from django.contrib.auth.models import User
class GameSerializer(serializers.ModelSerializer):
    player1 = serializers.SerializerMethodField()
    player2 = serializers.SerializerMethodField()
    winner = serializers.SerializerMethodField()

    class Meta:
        model = Game
        fields = "__all__"

    def get_player1(self, obj):
        return {
            "id": obj.player1.id,
            "username": obj.player1.username
        }

    def get_player2(self, obj):
        if obj.is_against_ai():
            return {
                "id": 0,
                "username": "AI"
            }
        elif isinstance(obj.player2, User):  # player2 is a real user
            return {
                "id": obj.player2.id,
                "username": obj.player2.username
            }
        elif obj.game_mode == Game.LOCAL_PVP and obj.player2_name_pvp_local:  # local PvP with placeholder name
            return {
                "id": 0,  # ID set to 0 for non-existent users
                "username": obj.player2_name_pvp_local
            }
        return None

    def get_winner(self, obj):
        return {
            "id": obj.winner.id,
            "username": obj.winner.username
        } if obj.winner else None