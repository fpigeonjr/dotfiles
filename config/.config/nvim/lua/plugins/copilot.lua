return {
  {
    "zbirenbaum/copilot.lua",
    cmd = "Copilot",
    event = "InsertEnter",
    config = function()
      require("copilot").setup({
        panel = {
          enabled = true,
          auto_refresh = false,
          keymap = {
            jump_prev = "[[",
            jump_next = "]]",
            accept = "<CR>",
            refresh = "gr",
            open = "<M-CR>",
          },
          layout = {
            position = "bottom",
            ratio = 0.4,
          },
        },
        suggestion = {
          enabled = true,
          auto_trigger = true,
          debounce = 75,
          keymap = {
            accept = "<C-j>",
            accept_word = "<C-l>",
            accept_line = "<C-k>",
            next = "<C-]>",
            prev = "<C-[>",
            dismiss = "<C-e>",
          },
        },
        filetypes = {
          yaml = false,
          help = false,
          gitcommit = false,
          gitrebase = false,
          hgcommit = false,
          svn = false,
          cvs = false,
          ["."] = false,
        },
        copilot_node_command = "node",
        server_opts_overrides = {},
      })

      -- Toggle functionality
      vim.keymap.set("n", "<leader>ct", function()
        require("copilot.suggestion").toggle_auto_trigger()
      end, { desc = "Toggle Copilot auto-trigger" })

      vim.keymap.set("n", "<leader>cp", ":Copilot panel<CR>", {
        desc = "Open Copilot panel"
      })

      vim.keymap.set("n", "<leader>cd", ":Copilot disable<CR>", {
        desc = "Disable Copilot"
      })

      vim.keymap.set("n", "<leader>ce", ":Copilot enable<CR>", {
        desc = "Enable Copilot"
      })
    end,
  },
}