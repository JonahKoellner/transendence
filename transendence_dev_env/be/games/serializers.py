from rest_framework import serializers
from .models import Game

class GameSerializer(serializers.ModelSerializer):
    player1 = serializers.SerializerMethodField()
    player2 = serializers.SerializerMethodField()
    winner = serializers.SerializerMethodField()

    class Meta:
        model = Game
        fields = '__all__'
        read_only_fields = ['start_time', 'end_time', 'duration', 'winner']

    def get_player1(self, obj):
        return {
            "id": obj.player1.id,
            "username": obj.player1.username
        }

    def get_player2(self, obj):
        # Return "AI" as the username if the game is against the AI, otherwise return player2's details
        if obj.is_against_ai():
            return {
                "id": 0,  # Default ID for AI or a specific identifier if you have one
                "username": "AI"
            }
        elif obj.player2:  # Check if player2 exists to avoid null errors
            return {
                "id": obj.player2.id,
                "username": obj.player2.username
            }
        return None  # In case player2 is not set

    def get_winner(self, obj):
        # Handle the winner field in case of null or actual player instance
        return {
            "id": obj.winner.id,
            "username": obj.winner.username
        } if obj.winner else None