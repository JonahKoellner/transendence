import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LoginComponent } from './auth/login/login.component';
import { RegisterComponent } from './auth/register/register.component';
import { VerifyOtpComponent } from './auth/verify-otp/verify-otp.component';
import { HomeComponent } from './home/home/home.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { SettingsComponent } from './settings/settings.component';
import { ProfileComponent } from './profile/profile.component';
import { AuthInterceptor } from './auth.interceptor';
import { NotificationsComponent } from './notifications/notifications/notifications.component';
import { FriendRequestDialogComponent } from './dialogs/friend-request-dialog/friend-request-dialog.component';
import { GameInviteDialogComponent } from './dialogs/game-invite-dialog/game-invite-dialog.component';
import { ChatWindowComponent } from './chat/chat-window/chat-window.component';
import { NotificationFilterPipe } from './pipes/notification-filter.pipe';
import { UserSearchComponent } from './home/user-search/user-search.component';
import { FriendListComponent } from './home/friend-list/friend-list.component';
import { SelectionComponent } from './games/selection/selection.component';
import { LocalPveComponent } from './games/local-pve/local-pve.component';
import { LocalPvpComponent } from './games/local-pvp/local-pvp.component';
import { OnlinePvpComponent } from './games/online-pvp/online-pvp.component';
import { CommonModule } from '@angular/common';
import { GameDetailsComponent } from './games/game-details/game-details.component';
import { UserDetailsComponent } from './profile/user-details/user-details.component';
import { NgChartsModule } from 'ng2-charts';
import { RouterModule } from '@angular/router';
import { GameCanvasComponent } from './games/local-pve/game-canvas/game-canvas.component';
import { GameCanvasComponentPVP } from './games/local-pvp/game-canvas/game-canvas.component';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { DurationPipe } from './duration.pipe';
import { StartComponent } from './games/tournament/local/start/start.component';
import { PvpGameCanvasComponent } from './games/tournament/local/pvp-game-canvas/pvp-game-canvas.component';
import { PveGameCanvasComponent } from './games/tournament/local/pve-game-canvas/pve-game-canvas.component';
import { TournamentListComponent } from './games/tournament/tournament-list/tournament-list.component';
import { TournamentDetailsComponent } from './games/tournament/tournament-details/tournament-details.component';
import { CreateRoomComponent } from './games/online-pvp/create-room/create-room.component';
import { JoinRoomComponent } from './games/online-pvp/join-room/join-room.component';
import { GameRoomComponent } from './games/online-pvp/game-room/game-room.component';
import { GameDisplayComponent } from './games/online-pvp/game-display/game-display.component';
import { AboutComponent } from './home/about/about.component';
import { GameRoomsComponent } from './games/online-pvp/game-rooms/game-rooms.component';
import { LeaderboardComponent } from './leaderboard/leaderboard.component';
import { ImageSelectorModalComponent } from './profile/image-selector-modal/image-selector-modal.component';
import { ArenaComponent } from './games/arena/arena.component';
import { ChaosComponent } from './games/chaos/chaos.component';
import { GameCanvasChaosComponent } from './games/chaos/game-canvas-chaos/game-canvas-chaos.component';
import { GameCanvasChaosPvpComponent } from './games/chaos/game-canvas-chaos-pvp/game-canvas-chaos-pvp.component';
import { GameCanvasComponentArena } from './games/arena/game-canvas/game-canvas.component';
import { GamesListComponent } from './games/games-list/games-list.component';
import { DeleteAccountModalComponent } from './profile/delete-account-modal/delete-account-modal.component';
import { FtAuthCallbackComponentComponent } from './profile/ft-auth-callback-component/ft-auth-callback-component.component';
import { RevalidateOtpComponent } from './auth/revalidate-otp/revalidate-otp.component';
@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    RegisterComponent,
    VerifyOtpComponent,
    HomeComponent,
    SettingsComponent,
    ProfileComponent,
    NotificationsComponent,
    FriendRequestDialogComponent,
    GameInviteDialogComponent,
    ChatWindowComponent,
    NotificationFilterPipe,
    UserSearchComponent,
    FriendListComponent,
    SelectionComponent,
    LocalPveComponent,
    LocalPvpComponent,
    OnlinePvpComponent,
    GameDetailsComponent,
    UserDetailsComponent,
    GameCanvasComponent,
    GameCanvasComponentPVP,
    DurationPipe,
    StartComponent,
    PvpGameCanvasComponent,
    PveGameCanvasComponent,
    TournamentListComponent,
    TournamentDetailsComponent,
    CreateRoomComponent,
    JoinRoomComponent,
    GameRoomComponent,
    GameDisplayComponent,
    AboutComponent,
    GameRoomsComponent,
    LeaderboardComponent,
    ImageSelectorModalComponent,
    ArenaComponent,
    ChaosComponent,
    GameCanvasChaosComponent,
    GameCanvasChaosPvpComponent,
    GameCanvasComponentArena,
    GamesListComponent,
    DeleteAccountModalComponent,
    FtAuthCallbackComponentComponent,
    RevalidateOtpComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    ReactiveFormsModule,
    AppRoutingModule,
    HttpClientModule,
    CommonModule,
    NgChartsModule,
    RouterModule,
    NgbModule
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
