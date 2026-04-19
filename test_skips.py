import urllib.request, json, re

# Look at Wikipedia page "Artificial intelligence"
url = 'http://127.0.0.1:3000/api/article?title=Artificial%20intelligence'
req = urllib.request.Request(url)
with urllib.request.urlopen(req) as response:
    html = json.loads(response.read().decode()).get('html', '')

print("Total length:", len(html))
