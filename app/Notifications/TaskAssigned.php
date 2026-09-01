<?php

namespace App\Notifications;

use App\Models\Task;
use Illuminate\Notifications\Notification;

/**
 * Fired from TaskController::store()/update() when a task is (re)assigned.
 * In-app only ('database' channel) — same reasoning as
 * App\Notifications\ParkingExchanged: no SMS/mail gateway configured yet.
 */
class TaskAssigned extends Notification
{
    public function __construct(protected Task $task) {}

    public function via($notifiable): array
    {
        return ['database'];
    }

    public function toDatabase($notifiable): array
    {
        $this->task->loadMissing(['team', 'assignedBy']);
        return [
            'type' => 'task_assigned',
            'title' => 'New Task Assigned',
            'message' => "\"{$this->task->title}\" ({$this->task->team->name}) assigned by {$this->task->assignedBy->name}",
            'task_id' => $this->task->id,
        ];
    }
}
