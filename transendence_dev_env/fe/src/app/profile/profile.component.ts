// profile.component.ts
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ProfileService, UserProfile } from '../profile.service';
import { Game, GameService } from '../games/game.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
})
export class ProfileComponent implements OnInit {
  profileForm!: FormGroup;
  avatarPreview!: string | ArrayBuffer;
  isLoading = true;
  userProfile!: UserProfile;
  gameHistory: Game[] = [];
  constructor(private profileService: ProfileService, private fb: FormBuilder, private gameService: GameService) {}

  ngOnInit() {
    this.profileForm = this.fb.group({
      display_name: [''],
      avatar: [null],
    });

    this.loadProfile();
  }

  loadProfile() {
    this.profileService.getProfile().subscribe(
      (data) => {
        this.isLoading = false;
        this.userProfile = data;
  
        // Set the display_name in the form
        this.profileForm.patchValue({
          display_name: data.display_name,
        });
  
        // Construct the full URL for the avatar
        const avatarUrl = data.avatar
          ? `http://localhost:8000${data.avatar}`
          : 'assets/default_avatar.png';
  
        this.avatarPreview = avatarUrl;
        this.loadGameHistory(data.id);
        console.log("Done loading", data);
  
        // Reset form to pristine state to avoid accidental submissions
        this.profileForm.markAsPristine();
      },
      (error) => {
        console.error(error);
        this.isLoading = false;
      }
    );
  }

  onFileChange(event: { target: any; }) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.profileForm.patchValue({
        avatar: file,
      });
      this.profileForm.get('avatar')?.updateValueAndValidity();

      // File Preview
      const reader = new FileReader();
      reader.onload = () => {
        this.avatarPreview = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }
  loadGameHistory(userId: number) {
    this.gameService.getGamesByUser(userId).subscribe(
      (games) => {
        this.gameHistory = games;
      },
      (error) => {
        console.error('Error loading game history:', error);
      }
    );
  }
  onSubmit() {
    const formData = new FormData();
    formData.append('display_name', this.profileForm.get('display_name')!.value);

    if (this.profileForm.get('avatar')?.value) {
      formData.append('avatar', this.profileForm.get('avatar')!.value);
    }

    this.profileService.updateProfile(formData).subscribe(
      (response) => {
        alert('Profile updated successfully');
        // Reload the profile to reflect changes
        this.loadProfile();
      },
      (error) => {
        console.error(error);
      }
    );
  }
  getGameStatus(game: any): string {
    const currentTime = new Date();
    const startTime = new Date(game.start_time);

    // Check if game is completed
    if (game.is_completed) {
      return 'Completed';
    }

    const TEN_MINUTES = 10 * 60 * 1000; // milliseconds in ten minutes
    if (!game.end_time && (currentTime.getTime() - startTime.getTime() > TEN_MINUTES)) {
      return 'Canceled';
    }

    // If the game has started but not completed, it's still "Running"
    if (game.start_time && !game.is_completed) {
      return 'Running';
    }

    return 'Unknown';
  }
  getXpProgress(): number {
    if (!this.userProfile) return 0;
    return Math.min((this.userProfile.xp / this.userProfile.xp_for_next_level) * 100, 100);
  }
}