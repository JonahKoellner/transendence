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
import { Local3dPvpComponent } from './games/3d/local-pvp/local-pvp.component';
import { PasswordResetComponent } from './auth/password-reset/password-reset.component';
import { PasswordResetConfirmComponent } from './auth/password-reset-confirm/password-reset-confirm.component';
import { PrivacyPolicyComponent } from './home/privacy-policy/privacy-policy.component';
import { DisclaimerComponent } from './home/disclaimer/disclaimer.component';
import { TermsOfServiceComponent } from './home/terms-of-service/terms-of-service.component';
import { OnlinePvpChaosComponent } from './games/online-pvp-chaos/online-pvp-chaos.component';
import { CreateRoomChaosComponent } from './games/online-pvp-chaos/create-room/create-room-chaos.component';
import { JoinRoomChaosComponent } from './games/online-pvp-chaos/join-room/join-room-chaos.component';
import { GameRoomsChaosComponent } from './games/online-pvp-chaos/game-rooms/game-rooms-chaos.component';
import { GameRoomChaosComponent } from './games/online-pvp-chaos/game-room/game-room-chaos.component';
import { OnlineArenaComponent } from './games/online-arena/online-arena.component';
import { CreateRoomArenaComponent } from './games/online-arena/create-room/create-room.component';
import { JoinRoomArenaComponent } from './games/online-arena/join-room/join-room.component';
import { GameRoomsArenaComponent } from './games/online-arena/game-rooms/game-rooms.component';
import { GameRoomArenaComponent } from './games/online-arena/game-room/game-room.component';
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
   { path: 'games/online-pvp-chaos',component: OnlinePvpChaosComponent, canActivate: [AuthGuard],
    children: [
      { path: 'rooms', component: GameRoomsChaosComponent, canActivate: [AuthGuard]},
      { path: 'create', component: CreateRoomChaosComponent, canActivate: [AuthGuard]},
      { path: 'join', component: JoinRoomChaosComponent, canActivate: [AuthGuard] }
    ],
   },
   { path: 'games/online-arena',component: OnlineArenaComponent, canActivate: [AuthGuard],
    children: [
      { path: 'rooms', component: GameRoomsArenaComponent, canActivate: [AuthGuard]},
      { path: 'create', component: CreateRoomArenaComponent, canActivate: [AuthGuard]},
      { path: 'join', component: JoinRoomArenaComponent, canActivate: [AuthGuard] }
    ],
   },
  { path: 'games/online-arena/game-room/:roomId', component: GameRoomArenaComponent, canActivate: [AuthGuard] },
  { path: 'games/online-pvp-chaos/game-room/:roomId', component: GameRoomChaosComponent, canActivate: [AuthGuard] },
  { path: 'games/online-pvp/game-room/:roomId', component: GameRoomComponent, canActivate: [AuthGuard] },
  { path: 'games/details/:id', component: GameDetailsComponent, canActivate: [AuthGuard] },
  { path: 'games/tournament/local/start', component: StartComponent, canActivate: [AuthGuard] },
  { path: 'games/tournament/details/:id', component: TournamentDetailsComponent, canActivate: [AuthGuard] },
  { path: 'games/tournament/local/list', component: TournamentListComponent, canActivate: [AuthGuard] },
  { path: 'games/list', component: GamesListComponent, canActivate: [AuthGuard] },
  { path: 'games/leaderboard', component: LeaderboardComponent, canActivate: [AuthGuard] },
  { path: 'games/chaos', component: ChaosComponent, canActivate: [AuthGuard] },
  { path: 'games/arena', component: ArenaComponent, canActivate: [AuthGuard] },
  { path: 'privacy-policy', component: PrivacyPolicyComponent},
  { path: 'disclaimer', component: DisclaimerComponent },
  { path: 'tos', component: TermsOfServiceComponent },
  { path: 'auth/callback', component: FtAuthCallbackComponentComponent },
  { path: 'forgot-password', component: PasswordResetComponent },
  { path: 'reset-password', component: PasswordResetConfirmComponent },
  { path: 'about', component: AboutComponent},
  { path: 'test', component: Local3dPvpComponent},
  { path: '**', redirectTo: 'login' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
