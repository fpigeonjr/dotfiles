return {
  {
    "kylechui/nvim-surround",
    version = "*",
    event = "VeryLazy",
    config = function()
      require("nvim-surround").setup()

      -- change only Visual mode to avoid Treesitter conflicts
      vim.keymap.set("v", "gS", "<Plug>(SurroundAdd)")
      vim.keymap.set("v", "gss", "<Plug>(SurroundAddLine)")
    end,
  },
}
