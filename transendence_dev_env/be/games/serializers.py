from rest_framework import serializers
from .models import Game
from django.contrib.auth.models import User
from .models import Tournament, Round, Match
class GameSerializer(serializers.ModelSerializer):
    player1 = serializers.SerializerMethodField()
    player2 = serializers.SerializerMethodField()
    player3 = serializers.SerializerMethodField()
    player4 = serializers.SerializerMethodField()
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
        if obj.game_mode in [Game.LOCAL_PVP, Game.CHAOS_PVP, Game.ARENA_PVP, Game.ONLINE_ARENA_PVP]:
            if obj.player2_name_pvp_local:
                return {
                    "id": 0,
                    "username": obj.player2_name_pvp_local
                }
            elif obj.player2:
                return {
                    "id": obj.player2.id,
                    "username": obj.player2.username
                }
        elif obj.is_against_ai():
            return {
                "id": 0,
                "username": "AI"
            }
        return None

    def get_player3(self, obj):
        if obj.game_mode in [Game.ARENA_PVP, Game.ONLINE_ARENA_PVP]:
            if obj.player3_name_pvp_local:
                return {
                    "id": 0,
                    "username": obj.player3_name_pvp_local
                }
            elif obj.player3:
                return {
                    "id": obj.player3.id,
                    "username": obj.player3.username
                }
        return None

    def get_player4(self, obj):
        if obj.game_mode in [Game.ARENA_PVP, Game.ONLINE_ARENA_PVP]:
            if obj.player4_name_pvp_local:
                return {
                    "id": 0,
                    "username": obj.player4_name_pvp_local
                }
            elif obj.player4:
                return {
                    "id": obj.player4.id,
                    "username": obj.player4.username
                }
        return None

    def get_winner(self, obj):
        if obj.winner:
            return {
                "id": obj.winner.id,
                "username": obj.winner.username
            }

        if obj.is_against_ai() and obj.score_player1 < obj.score_player2:
            return {
                "id": 0,
                "username": "AI"
            }

        if obj.game_mode in [Game.LOCAL_PVP, Game.CHAOS_PVP] and obj.player2_name_pvp_local and obj.score_player1 < obj.score_player2:
            return {
                "id": 0,
                "username": obj.player2_name_pvp_local
            }

        if obj.game_mode == Game.ARENA_PVP:
            scores = [obj.score_player1, obj.score_player2, obj.score_player3, obj.score_player4]
            max_score = max(scores)
            winners = [i for i, score in enumerate(scores, start=1) if score == max_score]
            if len(winners) == 1:
                winner_num = winners[0]
                if winner_num == 1:
                    return {
                        "id": obj.player1.id,
                        "username": obj.player1.username
                    }
                elif winner_num == 2:
                    return {
                        "id": 0,
                        "username": obj.player2_name_pvp_local
                    }
                elif winner_num == 3:
                    return {
                        "id": 0,
                        "username": obj.player3_name_pvp_local
                    }
                elif winner_num == 4:
                    return {
                        "id": 0,
                        "username": obj.player4_name_pvp_local
                    }
            else:
                return {
                    "id": -1,
                    "username": "Tie"
                }

        return None


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
    
    
class LeaderboardEntrySerializer(serializers.Serializer):
    rank = serializers.IntegerField()
    user_id = serializers.IntegerField()
    username = serializers.CharField()
    display_name = serializers.CharField()
    value = serializers.FloatField()

class UserStatsSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()
    username = serializers.CharField(max_length=150)
    display_name = serializers.CharField(max_length=255)
    level = serializers.IntegerField()
    xp = serializers.IntegerField()
    total_games_played = serializers.IntegerField()
    total_games_pve = serializers.IntegerField()
    total_games_pvp_local = serializers.IntegerField()
    total_games_pvp_online = serializers.IntegerField()
    total_games_won = serializers.IntegerField()
    total_games_lost = serializers.IntegerField()
    average_game_duration = serializers.FloatField()
    total_tournaments_participated = serializers.IntegerField()
    total_tournaments_won = serializers.IntegerField()
    average_tournament_duration = serializers.FloatField()
    
    # Ranking Fields
    rank_by_xp = serializers.IntegerField()
    rank_by_wins = serializers.IntegerField()
    rank_by_games_played = serializers.IntegerField()
    rank_by_tournament_wins = serializers.IntegerField()

class GlobalStatsSerializer(serializers.Serializer):
    total_users = serializers.IntegerField()
    total_games = serializers.IntegerField()
    total_pve_games = serializers.IntegerField()
    total_pvp_local_games = serializers.IntegerField()
    total_pvp_online_games = serializers.IntegerField()
    total_tournaments = serializers.IntegerField()
    completed_tournaments = serializers.IntegerField()
    average_games_per_user = serializers.FloatField()
    average_tournaments_per_user = serializers.FloatField()
    average_game_duration = serializers.FloatField()
    average_tournament_duration = serializers.FloatField()
    
    # Leaderboards
    leaderboard_xp = LeaderboardEntrySerializer(many=True)
    leaderboard_most_wins = LeaderboardEntrySerializer(many=True)
    leaderboard_most_games = LeaderboardEntrySerializer(many=True)
    leaderboard_most_tournament_wins = LeaderboardEntrySerializer(many=True)
    
    
class GameStatsSerializer(serializers.Serializer):
    game_mode = serializers.CharField()
    game_duration = serializers.FloatField()
    win_loss_status = serializers.DictField()
    rounds_info = serializers.ListField(child=serializers.DictField(), required=False)
    moves_log = serializers.ListField(child=serializers.DictField(), required=False)
    score_distribution = serializers.DictField()
    game_status = serializers.CharField()
    winner_info = serializers.DictField()