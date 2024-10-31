import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'duration'
})
export class DurationPipe implements PipeTransform {

  transform(value: number): string {
    if (typeof value !== 'number') {
      return '';
    }

    if (value < 60) {
      return `${value.toFixed(0)} sec`; // Display seconds if less than a minute
    }

    const minutes = Math.floor(value / 60);
    const seconds = Math.floor(value % 60);

    if (minutes < 60) {
      // Display minutes and seconds if less than an hour
      return `${minutes} min ${seconds} sec`;
    }

    // Display "1h+" or "99m+" if duration is an hour or more
    return minutes >= 99 ? '99m+' : '1h+';
  }
}
