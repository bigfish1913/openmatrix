# Claude Code Hooks Configuration Template

This file shows how to configure the OpenMatrix skills injector hook in your Claude Code settings.

## Location

Copy this configuration to: `~/.claude/settings.json`

## Hook Configuration

Add the following to your `settings.json` under the `hooks` section:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/hooks/om-skills-injector.js"
          }
        ]
      }
    ]
  }
}
```

## Full Example

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/hooks/om-skills-injector.js"
          }
        ]
      }
    ],
    "PreToolUse": [],
    "PostToolUse": [],
    "Stop": [],
    "SessionEnd": []
  },
  "permissions": {
    "allow": []
  }
}
```

## What This Hook Does

The `om-skills-injector.js` hook:

1. Reads all OpenMatrix skill files from `~/.claude/commands/om/*.md`
2. Extracts the `name` and `description` from each file's frontmatter
3. Formats them into a `<system-reminder>` block
4. Injects this context into the Claude session

This allows Claude to see the full list of available skills with their descriptions at the start of each session.

## Manual Activation

If you prefer not to modify settings.json, you can also run the hook manually:

```bash
node ~/.claude/hooks/om-skills-injector.js
```

This will output the JSON context that would be injected.

## Windows Path Note

On Windows, use the full path:

```json
{
  "command": "node C:/Users/YOUR_USERNAME/.claude/hooks/om-skills-injector.js"
}
```

Or use the home directory shorthand:

```json
{
  "command": "node ~/.claude/hooks/om-skills-injector.js"
}
```