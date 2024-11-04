import { Component } from '@angular/core';
import { Game, GameService } from '../game.service';

@Component({
  selector: 'app-selection',
  templateUrl: './selection.component.html',
  styleUrls: ['./selection.component.scss'],
})
export class SelectionComponent {

  isLoading = false;        // For displaying loading spinner
  constructor(private gameService: GameService) {}

  ngOnInit() {

  }
}