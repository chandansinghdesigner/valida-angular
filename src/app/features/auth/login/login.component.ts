import { Component, ViewEncapsulation, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  showPassword = false;
  submitting = false;
  formStatus: { type: 'error' | 'success'; message: string } | null = null;

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    remember: [true]
  });

  constructor() {
    const params = this.route.snapshot.queryParamMap;
    if (params.get('registered') === 'true') {
      this.formStatus = { type: 'success', message: 'Account created! Please sign in with your new credentials.' };
      const prefillEmail = params.get('email');
      if (prefillEmail) {
        this.form.patchValue({ email: prefillEmail });
      }
    }
  }

  get email() {
    return this.form.controls.email;
  }

  get password() {
    return this.form.controls.password;
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  submit(): void {
    this.formStatus = null;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting = true;
    const { email, password, remember } = this.form.getRawValue();

    this.auth.login({ email, password, remember }).subscribe({
      next: () => {
        this.submitting = false;
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || this.auth.homeRoute();
        this.router.navigateByUrl(returnUrl);
      },
      error: (err: Error) => {
        this.submitting = false;
        this.formStatus = { type: 'error', message: err.message };
      }
    });
  }
}
