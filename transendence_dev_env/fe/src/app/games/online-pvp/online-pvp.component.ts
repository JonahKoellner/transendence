import { Component } from '@angular/core';
import { Player } from '../game.service';
// import { UserSearchComponent } from 'src/app/home/user-search/user-search.component';

interface Lobby {
  id: number;
  name: string;
  players: Player[];
  currentPlayers: number;
  maxPlayers: number;
}

@Component({
  selector: 'app-online-pvp',
  templateUrl: './online-pvp.component.html',
  styleUrls: ['./online-pvp.component.scss']
})
export class OnlinePvpComponent {
  lobbies: Lobby[] = [];        // List of available lobbies
  selectedLobby: Lobby | null = null; // Currently selected lobby
  currentLobby: Lobby | null = null; // Joined lobby

  constructor() {
    this.loadLobbies();
  }

  // Load existing lobbies (dummy data here, ideally fetched from a server)
  loadLobbies() {
    this.lobbies = [/* { id: 1, name: 'Lobby 1' } */];
  }

  // Called when a lobby is clicked
  selectLobby(lobby: Lobby) {
    this.selectedLobby = lobby;
  }

  // Called when the "Create Lobby" button is clicked
  createLobby() {
    const newLobby: Lobby = { 
      id: this.lobbies.length + 1, 
      name: `Lobby ${this.lobbies.length + 1}`,
      players: [],
      currentPlayers: 0,
      maxPlayers: 2
    };
    this.lobbies.push(newLobby);
    this.currentLobby = newLobby; // Automatically select the new lobby
  }

  // Called when the "Join Lobby" button is clicked
  joinLobby() {
    if (this.selectedLobby) {
      this.currentLobby = this.selectedLobby;
      this.selectedLobby = null;
      console.log("Joined " + this.currentLobby.name);
    }
  }

  leaveLobby() {
    if (!this.currentLobby) return ;
    this.currentLobby = null;
  }

  ngOnDestroy() {
    this.leaveLobby();
  }
}
