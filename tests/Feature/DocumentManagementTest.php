<?php

namespace Tests\Feature;

use App\Models\AssetStatus;
use App\Models\Customer;
use App\Models\Project;
use App\Models\User;
use App\Models\Zone;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Roadmap Phase 14 — Document Management. Uploads go to the private
 * "local" disk (never web-accessible) and access re-checks the same
 * employee-privacy boundary as Phase 11.
 */
class DocumentManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_upload_and_download_a_project_document(): void
    {
        Storage::fake('local');
        AssetStatus::create(['code' => 'AVAILABLE', 'label' => 'Available', 'fill_color' => '#fff', 'border_color' => '#ccc', 'text_color' => '#000']);
        $zone = Zone::create(['name' => 'Z1']);
        $project = Project::create(['zone_id' => $zone->id, 'type' => 'regular', 'name' => 'P1', 'status' => 'Ongoing']);
        $owner = User::create(['name' => 'Owner', 'email' => 'owner@test.com', 'password' => 'password', 'role' => 'owner']);
        $token = $owner->createToken('api')->plainTextToken;

        $file = UploadedFile::fake()->image('brochure.jpg');
        $upload = $this->withHeader('Authorization', "Bearer $token")->postJson('/api/documents', [
            'documentable_type' => 'project',
            'documentable_id' => $project->id,
            'category' => 'Photo',
            'file' => $file,
        ]);
        $upload->assertCreated();
        $documentId = $upload->json('id');

        Storage::disk('local')->assertExists($upload->json('stored_path'));

        $download = $this->withHeader('Authorization', "Bearer $token")->get("/api/documents/{$documentId}/download");
        $download->assertOk();
    }

    public function test_employee_cannot_upload_or_view_documents_on_another_employees_customer(): void
    {
        Storage::fake('local');
        $rahim = User::create(['name' => 'Rahim', 'email' => 'rahim@test.com', 'password' => 'password', 'role' => 'employee']);
        $karim = User::create(['name' => 'Karim', 'email' => 'karim@test.com', 'password' => 'password', 'role' => 'employee']);
        $customer = Customer::create(['name' => 'Cust', 'assigned_employee_id' => $rahim->id]);

        $karimToken = $karim->createToken('api')->plainTextToken;
        $upload = $this->withHeader('Authorization', "Bearer $karimToken")->postJson('/api/documents', [
            'documentable_type' => 'customer',
            'documentable_id' => $customer->id,
            'file' => UploadedFile::fake()->image('nid.jpg'),
        ]);
        $upload->assertStatus(403);

        $list = $this->withHeader('Authorization', "Bearer $karimToken")->getJson("/api/documents?documentable_type=customer&documentable_id={$customer->id}");
        $list->assertStatus(403);
    }

    public function test_only_uploader_or_manager_can_delete_a_document(): void
    {
        Storage::fake('local');
        AssetStatus::create(['code' => 'AVAILABLE', 'label' => 'Available', 'fill_color' => '#fff', 'border_color' => '#ccc', 'text_color' => '#000']);
        $zone = Zone::create(['name' => 'Z1']);
        $project = Project::create(['zone_id' => $zone->id, 'type' => 'regular', 'name' => 'P1', 'status' => 'Ongoing']);
        $rahim = User::create(['name' => 'Rahim', 'email' => 'rahim@test.com', 'password' => 'password', 'role' => 'employee']);
        $karim = User::create(['name' => 'Karim', 'email' => 'karim@test.com', 'password' => 'password', 'role' => 'employee']);

        $rahimToken = $rahim->createToken('api')->plainTextToken;
        $upload = $this->withHeader('Authorization', "Bearer $rahimToken")->postJson('/api/documents', [
            'documentable_type' => 'project',
            'documentable_id' => $project->id,
            'file' => UploadedFile::fake()->image('a.jpg'),
        ]);
        $documentId = $upload->json('id');

        // Sanctum's guard caches the resolved user on first Auth::user()
        // call within a test — reset it before switching identities so
        // each request re-authenticates against its own token.
        Auth::forgetGuards();
        $karimToken = $karim->createToken('api')->plainTextToken;
        $this->withHeader('Authorization', "Bearer $karimToken")->deleteJson("/api/documents/{$documentId}")->assertStatus(403);

        Auth::forgetGuards();
        $this->withHeader('Authorization', "Bearer $rahimToken")->deleteJson("/api/documents/{$documentId}")->assertOk();
    }
}
