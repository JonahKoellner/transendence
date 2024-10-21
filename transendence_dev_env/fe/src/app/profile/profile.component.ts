// profile.component.ts
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ProfileService, UserProfile } from '../profile.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
})
export class ProfileComponent implements OnInit {
  profileForm!: FormGroup;
  avatarPreview!: string | ArrayBuffer;
  isLoading = true;
  userProfile!: UserProfile;

  constructor(private profileService: ProfileService, private fb: FormBuilder) {}

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
}