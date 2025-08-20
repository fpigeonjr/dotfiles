return {
  {
    "kylechui/nvim-surround",
    version = "*",
    event = "VeryLazy",
    config = function()
      require("nvim-surround").setup({
        keymaps = {
          -- keep normal mode as default (ys/cs/ds/yS)
          -- change only Visual mode to avoid Treesitter conflicts
          visual = "gS", -- was "S"
          visual_line = "gss", -- was "gS"
        },
      })
    end,
  },
}
