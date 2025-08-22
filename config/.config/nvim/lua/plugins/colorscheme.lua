return {
  {
    "sainnhe/everforest",
    lazy = false,
    priority = 1000,
    init = function()
      -- Set up everforest variants
      vim.g.everforest_background = "soft"
      vim.g.everforest_transparent_background = 0
    end,
    config = function()
      -- Create colorscheme files for each variant
      local config_path = vim.fn.stdpath("config")
      local colors_dir = config_path .. "/colors"
      
      -- Create colors directory if it doesn't exist
      vim.fn.mkdir(colors_dir, "p")
      
      -- Create variant colorscheme files
      local variants = {"soft", "medium", "hard"}
      for _, variant in ipairs(variants) do
        local content = string.format([[
" Everforest %s variant
let g:everforest_background = '%s'
runtime colors/everforest.vim
let g:colors_name = 'everforest-%s'
]], variant, variant, variant)
        
        local file_path = colors_dir .. "/everforest-" .. variant .. ".vim"
        local file = io.open(file_path, "w")
        if file then
          file:write(content)
          file:close()
        end
      end
      
      vim.cmd.colorscheme("everforest")
    end,
  },
  {
    "LazyVim/LazyVim",
    opts = {
      colorscheme = "everforest",
    },
  },
}
