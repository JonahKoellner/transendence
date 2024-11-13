// profile.component.ts
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ProfileService, UserProfile } from '../profile.service';
import { Game, GameService } from '../games/game.service';
import { Tournament } from '../games/tournament/local/start/start.component';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent implements OnInit {
  profileForm!: FormGroup;
  avatarPreview!: string | ArrayBuffer;
  isLoading = true;
  userProfile!: UserProfile;

  constructor(private profileService: ProfileService, private fb: FormBuilder, private gameService: GameService) {}

  ngOnInit() {
    this.profileForm = this.fb.group({
      display_name: [''],
      avatar: [null],
    });

    this.loadProfile();
  }

  loadProfile() {
    this.isLoading = true;
  
    this.profileService.getProfile().subscribe(
      (data) => {
        this.userProfile = data;
  
        // Set the display_name in the form and update avatar
        this.profileForm.patchValue({ display_name: data.display_name });
        this.avatarPreview = data.avatar ? data.avatar : 'assets/default_avatar.png';
  
        // Mark form as pristine to avoid accidental submissions
        this.profileForm.markAsPristine()
        this.isLoading = false;

      },
      (error) => {
        console.error('Error loading profile:', error);
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

  onSubmit() {
    this.isLoading = true;
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
        this.isLoading = false;
        console.error(error);
      }
    );
  }

  getXpProgress(): number {
    if (!this.userProfile) return 0;
    return Math.min((this.userProfile.xp / this.userProfile.xp_for_next_level) * 100, 100);
  }
}