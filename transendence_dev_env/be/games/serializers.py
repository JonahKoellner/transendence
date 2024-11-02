from rest_framework import serializers
from .models import Game
from django.contrib.auth.models import User
from .models import Tournament, Round, Match
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
        # Check for local PvP placeholder name first
        if obj.game_mode == Game.LOCAL_PVP and obj.player2_name_pvp_local:
            return {
                "id": 0,  # Placeholder ID for non-existent users
                "username": obj.player2_name_pvp_local
            }
        elif obj.is_against_ai():  # Handle AI case
            return {
                "id": 0,
                "username": "AI"
            }
        elif isinstance(obj.player2, User):  # player2 is a real user
            return {
                "id": obj.player2.id,
                "username": obj.player2.username
            }
        return None  # No player2 set

    def get_winner(self, obj):
        return {
            "id": obj.winner.id,
            "username": obj.winner.username
        } if obj.winner else None
        


class MatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Match
        fields = '__all__'

class RoundSerializer(serializers.ModelSerializer):
    matches = MatchSerializer(many=True)

    class Meta:
        model = Round
        fields = '__all__'

class TournamentSerializer(serializers.ModelSerializer):
    rounds = RoundSerializer(many=True)
    host = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())

    class Meta:
        model = Tournament
        fields = [
            'id', 'name', 'type', 'rounds', 'final_winner', 'final_winner_type',
            'all_participants', 'players_only', 'created_at', 'start_time',
            'end_time', 'duration', 'status', 'winner_determination_method_message',
            'tiebreaker_method', 'winner_tie_resolved', 'host'
        ]

    def create(self, validated_data):
        rounds_data = validated_data.pop('rounds', [])
        tournament = Tournament.objects.create(**validated_data)

        for round_data in rounds_data:
            matches_data = round_data.pop('matches', [])
            round_instance = Round.objects.create(**round_data)
            round_instance.tournaments.add(tournament)

            for match_data in matches_data:
                # Create Match instance without assigning to reverse ManyToMany field
                match_instance = Match.objects.create(**match_data)
                # Associate Match with Round using the 'matches' field on Round
                round_instance.matches.add(match_instance)
            
            round_instance.save()

        return tournament

    def update(self, instance, validated_data):
        # Update simple fields of the Tournament
        instance.name = validated_data.get('name', instance.name)
        instance.type = validated_data.get('type', instance.type)
        instance.final_winner = validated_data.get('final_winner', instance.final_winner)
        instance.final_winner_type = validated_data.get('final_winner_type', instance.final_winner_type)
        instance.all_participants = validated_data.get('all_participants', instance.all_participants)
        instance.players_only = validated_data.get('players_only', instance.players_only)
        instance.start_time = validated_data.get('start_time', instance.start_time)
        instance.end_time = validated_data.get('end_time', instance.end_time)
        instance.duration = validated_data.get('duration', instance.duration)
        instance.status = validated_data.get('status', instance.status)
        instance.winner_determination_method_message = validated_data.get(
            'winner_determination_method_message', instance.winner_determination_method_message)
        instance.tiebreaker_method = validated_data.get('tiebreaker_method', instance.tiebreaker_method)
        instance.winner_tie_resolved = validated_data.get('winner_tie_resolved', instance.winner_tie_resolved)
        instance.host = validated_data.get('host', instance.host)
        instance.save()

        # Update rounds and matches
        rounds_data = validated_data.get('rounds')
        if rounds_data:
            # Clear existing rounds and their associated matches
            instance.rounds.clear()

            new_rounds = []
            for round_data in rounds_data:
                matches_data = round_data.pop('matches', [])
                round_instance = Round.objects.create(**round_data)
                round_instance.tournaments.add(instance)

                for match_data in matches_data:
                    # Create Match instance and associate it with the Round
                    match_instance = Match.objects.create(**match_data)
                    round_instance.matches.add(match_instance)

                round_instance.save()
                new_rounds.append(round_instance)

            # Associate new rounds with the tournament
            instance.rounds.set(new_rounds)

        return instance