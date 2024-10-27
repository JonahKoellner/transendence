from rest_framework import serializers
from .models import Game

class GameSerializer(serializers.ModelSerializer):
    player1 = serializers.StringRelatedField()
    player2 = serializers.SerializerMethodField()
    winner = serializers.StringRelatedField()

    class Meta:
        model = Game
        fields = '__all__'
        read_only_fields = ['start_time', 'end_time', 'duration', 'winner']

    def get_player2(self, obj):
        return "AI" if obj.is_against_ai() else str(obj.player2)