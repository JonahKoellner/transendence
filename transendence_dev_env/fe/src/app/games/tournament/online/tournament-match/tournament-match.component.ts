import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TournamentMatchService } from 'src/app/services/tournament-match.service';
import { Subscription } from 'rxjs';
import { ProfileService, UserProfile } from 'src/app/profile.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-tournament-match',
  templateUrl: './tournament-match.component.html',
  styleUrls: ['./tournament-match.component.scss'],
})
export class TournamentMatchComponent implements OnInit, OnDestroy {
  matchId: string = '';
  roomId: string = '';
  players: { player1: string; player2: string } = { player1: '', player2: '' };
  // Reuse your existing game state objects
  gameState: any = {};
  leftScore: number = 0;
  rightScore: number = 0;
  gameInProgress = false;
  private messageSubscription!: Subscription;
  userProfile: UserProfile | null = null;
  winner: string = '';

  constructor(
    private route: ActivatedRoute,
    private matchService: TournamentMatchService,
    private userProfileService: ProfileService,
    private router: Router,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    // grab matchId and roomId (from tournament)
    this.matchId = this.route.snapshot.paramMap.get('matchId') || '';
    this.roomId = this.route.snapshot.paramMap.get('roomId') || '';

    // 2. Join/connect to the match’s socket
    this.matchService.joinMatch(this.matchId).subscribe({
      next: () => {
        // Open socket connection
        this.matchService.connect(this.matchId, this.roomId);

        // Start listening for server messages
        this.messageSubscription = this.matchService.messages$.subscribe(
          (msg: any) => {
            this.handleServerMessage(msg);
          }
        );
      },
      error: () => {
        this.toastr.error('Error while joining match.', 'Error');
        // Decide where to navigate in a tournament context:
        // Possibly back to the user’s bracket or “tournament dashboard”
        this.router.navigate(['/tournament']);
      },
    });
    //i dont think ill need the user profile
    // // 3. Fetch the user’s profile if needed
    // this.userProfileService.getProfile().subscribe((profile) => {
    //   this.userProfile = profile;
    // });
  }

  handleServerMessage(msg: any): void {
    switch (msg.type) {
      case 'initial_state':
        // You might have different keys here, adapt as needed
        this.players.player1 = msg.player1;
        this.players.player2 = msg.player2;
        // ...
        break;
      case 'game_state':
        this.gameState = msg;
        this.leftScore = msg.leftScore;
        this.rightScore = msg.rightScore;
        break;
      case 'game_started':
        this.gameInProgress = true;
        break;
      case 'game_ended':
        this.gameInProgress = false;
        this.winner = msg.winner;
        // NEW: Instead of “redirect to /games/online-pvp/rooms,”
        // you’ll want to notify the bracket that matchId is finished.
        break;
      // ... handle other message types
    }
  }

  startGame(): void {
    // Possibly only the tournament server or a “match admin” can do this
    this.matchService.sendMessage({
      action: 'start_game',
      matchId: this.matchId,
    });
  }

  // Send keystrokes
  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    this.matchService.sendMessage({
      action: 'keydown',
      key: event.code,
      matchId: this.matchId,
      userId: this.userProfile?.id,
    });
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp(event: KeyboardEvent): void {
    this.matchService.sendMessage({
      action: 'keyup',
      key: event.code,
      matchId: this.matchId,
      userId: this.userProfile?.id,
    });
  }

  ngOnDestroy(): void {
    if (this.messageSubscription) {
      this.messageSubscription.unsubscribe();
    }
    this.matchService.disconnect();
  }
}
