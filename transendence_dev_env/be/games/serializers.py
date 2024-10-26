from rest_framework import serializers
from .models import Game

class GameSerializer(serializers.ModelSerializer):
    player1 = serializers.StringRelatedField()
    player2 = serializers.StringRelatedField()
    winner = serializers.StringRelatedField()

    class Meta:
        model = Game
        fields = '__all__'
        read_only_fields = ['start_time', 'end_time', 'duration', 'winner']