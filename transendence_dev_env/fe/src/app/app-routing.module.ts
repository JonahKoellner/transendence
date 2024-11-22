import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './auth/login/login.component';
import { RegisterComponent } from './auth/register/register.component';
import { VerifyOtpComponent } from './auth/verify-otp/verify-otp.component';
import { AuthGuard } from './auth.guard';
import { HomeComponent } from './home/home/home.component';
import { ProfileComponent } from './profile/profile.component';
import { FriendListComponent } from './home/friend-list/friend-list.component';
import { SelectionComponent } from './games/selection/selection.component';
import { GameDetailsComponent } from './games/game-details/game-details.component';
import { UserDetailsComponent } from './profile/user-details/user-details.component';
import { LocalPveComponent } from './games/local-pve/local-pve.component';
import { LocalPvpComponent } from './games/local-pvp/local-pvp.component';
import { OnlinePvpComponent } from './games/online-pvp/online-pvp.component';
import { StartComponent } from './games/tournament/local/start/start.component';
import { TournamentDetailsComponent } from './games/tournament/tournament-details/tournament-details.component';
import { TournamentListComponent } from './games/tournament/tournament-list/tournament-list.component';
import { CreateRoomComponent } from './games/online-pvp/create-room/create-room.component';
import { JoinRoomComponent } from './games/online-pvp/join-room/join-room.component';
import { GameRoomComponent } from './games/online-pvp/game-room/game-room.component';
import { AboutComponent } from './home/about/about.component';
import { GameRoomsComponent } from './games/online-pvp/game-rooms/game-rooms.component';
import { LeaderboardComponent } from './leaderboard/leaderboard.component';
import { ArenaComponent } from './games/arena/arena.component';
import { ChaosComponent } from './games/chaos/chaos.component';
import { GamesListComponent } from './games/games-list/games-list.component';
import { FtAuthCallbackComponentComponent } from './profile/ft-auth-callback-component/ft-auth-callback-component.component';
import { RevalidateOtpComponent } from './auth/revalidate-otp/revalidate-otp.component';
const routes: Routes = [
  { path: 'login', component: LoginComponent},
  { path: 'register', component: RegisterComponent},
  { path: 'verify-otp/:id', component: VerifyOtpComponent },
  { path: 'revalidate-otp', component: RevalidateOtpComponent },
  { path: 'profile', component: ProfileComponent, canActivate: [AuthGuard] },
  { path: 'profile/user-details/:id', component: UserDetailsComponent, canActivate: [AuthGuard] },
  { path: 'home', component: HomeComponent, canActivate: [AuthGuard] },
  { path: 'friends', component: FriendListComponent, canActivate: [AuthGuard] },
  { path: 'games',component: SelectionComponent, canActivate: [AuthGuard] },
  { path: 'games/local-pve',component: LocalPveComponent, canActivate: [AuthGuard] },
  { path: 'games/local-pvp',component: LocalPvpComponent, canActivate: [AuthGuard] },
  { path: 'games/online-pvp',component: OnlinePvpComponent, canActivate: [AuthGuard],
    children: [
      { path: 'rooms', component: GameRoomsComponent, canActivate: [AuthGuard]},
      { path: 'create', component: CreateRoomComponent, canActivate: [AuthGuard]},
      { path: 'join', component: JoinRoomComponent, canActivate: [AuthGuard] }
    ],
   },
  { path: 'games/online-pvp/game-room/:roomId', component: GameRoomComponent, canActivate: [AuthGuard] },
  { path: 'games/details/:id', component: GameDetailsComponent, canActivate: [AuthGuard] },
  { path: 'games/tournament/local/start', component: StartComponent, canActivate: [AuthGuard] },
  { path: 'games/tournament/details/:id', component: TournamentDetailsComponent, canActivate: [AuthGuard] },
  { path: 'games/tournament/local/list', component: TournamentListComponent, canActivate: [AuthGuard] },
  { path: 'games/list', component: GamesListComponent, canActivate: [AuthGuard] },
  { path: 'games/leaderboard', component: LeaderboardComponent, canActivate: [AuthGuard] },
  { path: 'games/chaos', component: ChaosComponent, canActivate: [AuthGuard] },
  { path: 'games/arena', component: ArenaComponent, canActivate: [AuthGuard] },
  { path: 'auth/callback', component: FtAuthCallbackComponentComponent },
  { path: 'about', component: AboutComponent},
  { path: '**', redirectTo: 'login' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
