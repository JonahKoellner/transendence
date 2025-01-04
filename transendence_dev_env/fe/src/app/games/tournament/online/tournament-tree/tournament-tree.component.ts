import { Component } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-tournament-tree',
  templateUrl: './tournament-tree.component.html',
  styleUrls: ['./tournament-tree.component.scss']
})
export class TournamentTreeComponent {
  constructor(private router: Router, private route: ActivatedRoute) { }

  navigateToLobby(): void {
    let roomId = this.route.snapshot.paramMap.get('roomId');
    console.log('Navigating to the lobby, with this roomId: ' + roomId);
    this.router.navigate(['/games/online-tournament/room/' + roomId])
    console.log('Navigating to the lobby...');
  }
}
