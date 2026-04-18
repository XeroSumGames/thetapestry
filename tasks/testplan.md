# Test Plan — Pin to Tactical Map Linking

## Prerequisites
- [ ] Run SQL migration: `ALTER TABLE public.campaign_pins ADD COLUMN IF NOT EXISTS tactical_scene_id uuid REFERENCES public.tactical_scenes(id) ON DELETE SET NULL;`
- [ ] Use a campaign that has at least one tactical scene created (e.g. The Arena)
- [ ] Be logged in as GM for that campaign

## Step 1: Verify scenes exist
- [ ] Go to `/stories/[id]/table` for your campaign
- [ ] Click "Tactical Map" button in the header
- [ ] Confirm you see a scene (e.g. "The Arena") in the scene dropdown on the left panel
- [ ] Switch back to "Campaign Map"

## Step 2: Verify pins exist
- [ ] In the right sidebar, click the "Assets" tab
- [ ] Confirm you see campaign pins listed
- [ ] If no pins, create one by clicking on the campaign map

## Step 3: Edit a pin and link a scene
- [ ] Click "Edit" on a pin in the Assets sidebar
- [ ] You should see: Name, Notes, Lat, Lng fields
- [ ] Below Longitude, you should see a "Tactical Map" label with a dropdown
- [ ] The dropdown should list "— None —" plus all tactical scenes for this campaign
- [ ] Select a scene from the dropdown
- [ ] Click "Save"

## Step 4: Verify the link saved
- [ ] The pin should now show a 🗺️ icon next to its name
- [ ] Click "Edit" on the same pin again
- [ ] The Tactical Map dropdown should show your selected scene pre-selected

## Step 5: Double-click to open tactical map
- [ ] Click the pin once to expand it (shows notes/images)
- [ ] Double-click the pin name/text area
- [ ] The view should switch from Campaign Map to the linked Tactical Map
- [ ] The linked scene should be the active one

## Step 6: Unlink
- [ ] Edit the pin again
- [ ] Change the Tactical Map dropdown back to "— None —"
- [ ] Save
- [ ] The 🗺️ icon should disappear
- [ ] Double-clicking should no longer switch to tactical map

## Troubleshooting
- **No dropdown visible**: Check that you're logged in as GM AND the campaign has at least one tactical scene
- **Dropdown visible but empty**: Check the Supabase `tactical_scenes` table has rows for this campaign_id
- **Save doesn't persist**: Check browser console for errors — the `tactical_scene_id` column may not exist yet
