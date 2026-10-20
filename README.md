# Open Shelf

A local-first listing studio for independent marketplace sellers. Add product notes and an optional photo to get a draft title, description, search tags, category, pricing thought, and a checklist of details to confirm.

## Why open AI?

Open Shelf uses the open-weight Qwen2.5-VL model through Ollama, an open-source local inference runtime. The photo and product notes are processed on the seller's computer instead of being uploaded to a hosted AI API. There is no API key, usage-based AI bill, or dependency on one provider's pricing. Sellers can swap the model by setting `OLLAMA_MODEL`; the default is `qwen2.5vl:3b`.

The model must be downloaded once. After that, listing generation works without an internet connection, subject to the model's local hardware requirements.

## Run it

1. Install [Ollama](https://ollama.com/) and start it.
2. Download the default vision model:

   ```sh
   ollama pull qwen2.5vl:3b
   ```

3. Start Open Shelf with Node.js 18 or newer:

   ```sh
   npm start
   ```

4. Open [http://localhost:3000](http://localhost:3000).

To use another Ollama model, set `OLLAMA_MODEL` before starting the server. To point at a different Ollama instance, set `OLLAMA_URL`. The server listens on `127.0.0.1` only, so the app is intended for use on the same computer.

## Privacy and limitations

Product photos and notes are sent only from the browser to this local server, then to the Ollama instance configured on the machine. The app does not persist submitted data. Listing text is a draft: verify every product detail and treat pricing guidance as a starting point, not an appraisal.
