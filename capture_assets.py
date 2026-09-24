import os
import time
import shutil
from playwright.sync_api import sync_playwright
import imageio_ffmpeg

ROOT = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR = os.path.join(ROOT, 'docs', 'assets')
os.makedirs(ASSETS_DIR, exist_ok=True)

TEMP_VIDEO_DIR = os.path.join(ROOT, 'docs', 'temp_video')
if os.path.exists(TEMP_VIDEO_DIR):
    shutil.rmtree(TEMP_VIDEO_DIR)
os.makedirs(TEMP_VIDEO_DIR, exist_ok=True)

def run():
    print("Launching browser via Playwright...")
    with sync_playwright() as p:
        browser = p.chromium.launch(
            channel="msedge",
            headless=True
        )
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            record_video_dir=TEMP_VIDEO_DIR,
            record_video_size={"width": 1920, "height": 1080}
        )
        page = context.new_page()

        print("Navigating to http://172.24.0.5:8089...")
        page.goto("http://172.24.0.5:8089", wait_until="networkidle")
        time.sleep(2)

        # 1. Screenshot VS screen
        vs_shot = os.path.join(ASSETS_DIR, "screenshot_vs.png")
        page.screenshot(path=vs_shot)
        print(f"Captured: {vs_shot}")

        # 2. Open Settings Drawer
        page.click("#btn-open-settings")
        time.sleep(1)
        settings_shot = os.path.join(ASSETS_DIR, "screenshot_settings.png")
        page.screenshot(path=settings_shot)
        print(f"Captured: {settings_shot}")

        # Switch to JEV tab to show Secret Key
        page.click('button[data-tab="jev"]')
        time.sleep(0.8)
        jev_shot = os.path.join(ASSETS_DIR, "screenshot_settings_sk.png")
        page.screenshot(path=jev_shot)
        print(f"Captured: {jev_shot}")

        # Close Drawer
        page.click("#btn-close-drawer")
        time.sleep(0.8)

        # 3. Start Battle
        page.click("#go")
        print("Started battle, waiting for countdown and gameplay...")
        time.sleep(7) # 3, 2, 1, GO + a few placements

        battle_shot = os.path.join(ASSETS_DIR, "screenshot_battle.png")
        page.screenshot(path=battle_shot)
        print(f"Captured: {battle_shot}")

        # Wait a bit more for video recording
        time.sleep(6)

        # Close context to finalize video
        page.close()
        context.close()
        browser.close()

    # Convert recorded webm to mp4
    video_files = [f for f in os.listdir(TEMP_VIDEO_DIR) if f.endswith('.webm')]
    if video_files:
        raw_webm = os.path.join(TEMP_VIDEO_DIR, video_files[0])
        out_mp4 = os.path.join(ASSETS_DIR, "demo_video.mp4")
        ffmpeg_bin = imageio_ffmpeg.get_ffmpeg_exe()
        print(f"Converting {raw_webm} to {out_mp4} using {ffmpeg_bin}...")
        import subprocess
        subprocess.run([
            ffmpeg_bin, '-y', '-i', raw_webm,
            '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p',
            out_mp4
        ], check=True)
        print(f"Demo video saved to: {out_mp4}")
    
    # Cleanup temp video dir
    shutil.rmtree(TEMP_VIDEO_DIR, ignore_errors=True)
    print("All visual assets generated successfully!")

if __name__ == '__main__':
    run()
